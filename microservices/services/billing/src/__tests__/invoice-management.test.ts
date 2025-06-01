import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { BillingService } from "../services/billing-service";
import { Pool } from "pg";

// Mock the pg Pool
jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  })),
}));

// Mock the stripe service
jest.mock("../services/stripe-service", () => ({
  StripeService: jest.fn().mockImplementation(() => ({
    invoices: {
      finalizeInvoice: jest.fn(),
      pay: jest.fn(),
      voidInvoice: jest.fn(),
      markUncollectible: jest.fn(),
      sendInvoice: jest.fn(),
      retrieve: jest.fn(),
    },
  })),
}));

// Mock the usage service
jest.mock("../services/usage-service", () => ({
  UsageService: jest.fn().mockImplementation(() => ({
    getUsage: jest.fn(),
  })),
}));

describe("BillingService - Invoice Management", () => {
  let billingService: BillingService;
  let mockClient: any;
  let mockQuery: jest.MockedFunction<any>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    
    mockQuery = jest.fn();
    
    // Mock Pool methods
    const MockedPool = Pool as jest.MockedClass<typeof Pool>;
    MockedPool.prototype.connect = jest.fn().mockResolvedValue(mockClient);
    MockedPool.prototype.query = mockQuery;
    
    billingService = new BillingService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getUserInvoices", () => {
    it("should fetch user invoices with default pagination", async () => {
      const mockInvoices = [
        {
          id: "inv_1",
          organization_id: "org_123",
          subtotal: "100.00",
          tax: "8.75",
          total: "108.75",
          status: "paid",
          created_at: new Date(),
        },
        {
          id: "inv_2", 
          organization_id: "org_123",
          subtotal: "200.00",
          tax: "17.50",
          total: "217.50",
          status: "open",
          created_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockInvoices });

      const result = await billingService.getUserInvoices("org_123");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT i.*, s.billing_cycle, p.display_name as plan_name"),
        ["org_123", 50, 0]
      );
      
      expect(result).toHaveLength(2);
      expect(result[0].subtotal).toBe(100);
      expect(result[0].tax).toBe(8.75);
      expect(result[0].total).toBe(108.75);
    });

    it("should filter invoices by status", async () => {
      const mockInvoices = [
        {
          id: "inv_1",
          organization_id: "org_123", 
          subtotal: "100.00",
          tax: "8.75",
          total: "108.75",
          status: "open",
          created_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockInvoices });

      await billingService.getUserInvoices("org_123", { status: "open" });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("AND i.status = $2"),
        ["org_123", "open", 50, 0]
      );
    });

    it("should handle pagination options", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await billingService.getUserInvoices("org_123", { page: 2, limit: 25 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT $2 OFFSET $3"),
        ["org_123", 25, 25]
      );
    });

    it("should handle database errors gracefully", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database connection failed"));

      await expect(billingService.getUserInvoices("org_123")).rejects.toThrow("Failed to fetch invoices");
    });
  });

  describe("createInvoice", () => {
    it("should create invoice with items and calculate totals", async () => {
      const invoiceData = {
        organization_id: "org_123",
        subscription_id: "sub_123",
        items: [
          { description: "Service A", quantity: 2, unit_price: 50, type: "service" },
          { description: "Service B", quantity: 1, unit_price: 100, type: "service" },
        ],
        currency: "USD",
      };

      const mockInvoice = {
        id: "inv_123",
        organization_id: "org_123",
        subscription_id: "sub_123",
        currency: "USD",
        subtotal: "200.00",
        tax: "17.50", 
        total: "217.50",
        status: "draft",
      };

      // Mock transaction calls
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockInvoice] }) // INSERT invoice
        .mockResolvedValueOnce(undefined) // INSERT item 1
        .mockResolvedValueOnce(undefined) // INSERT item 2
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await billingService.createInvoice(invoiceData);

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO invoices"),
        ["org_123", "sub_123", "USD", 200, 17.5, 217.5, "draft", expect.any(Date), expect.any(Date), expect.any(Date)]
      );
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      
      expect(result.subtotal).toBe(200);
      expect(result.tax).toBe(17.5);
      expect(result.total).toBe(217.5);
    });

    it("should rollback transaction on error", async () => {
      const invoiceData = {
        organization_id: "org_123", 
        subscription_id: "sub_123",
        items: [{ description: "Service", quantity: 1, unit_price: 100 }],
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error("Database error")); // INSERT fails

      await expect(billingService.createInvoice(invoiceData)).rejects.toThrow("Failed to create invoice");

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });

  describe("finalizeInvoice", () => {
    it("should finalize draft invoice and generate number", async () => {
      const mockInvoice = {
        id: "inv_123",
        organization_id: "org_123",
        status: "open",
        number: "INV-1234567890123",
        subtotal: "100.00",
        tax: "8.75",
        total: "108.75",
        stripe_invoice_id: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockInvoice] });

      const result = await billingService.finalizeInvoice("inv_123", "org_123");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE invoices"),
        [expect.stringMatching(/^INV-\d+$/), "inv_123", "org_123"]
      );
      
      expect(result.status).toBe("open");
      expect(result.number).toMatch(/^INV-\d+$/);
    });

    it("should handle non-existent invoice", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(billingService.finalizeInvoice("invalid_id", "org_123"))
        .rejects.toThrow("Invoice not found or cannot be finalized");
    });
  });

  describe("payInvoice", () => {
    it("should mark invoice as paid when already paid", async () => {
      // Mock getInvoice to return paid invoice
      const mockPaidInvoice = { id: "inv_123", status: "paid" };
      jest.spyOn(billingService, "getInvoice").mockResolvedValueOnce(mockPaidInvoice as any);

      const result = await billingService.payInvoice("inv_123", "org_123", {});

      expect(result.success).toBe(true);
      expect(result.message).toBe("Invoice already paid");
    });

    it("should process payment with Stripe when payment method provided", async () => {
      const mockInvoice = { 
        id: "inv_123", 
        status: "open", 
        stripe_invoice_id: "stripe_inv_123" 
      };
      
      jest.spyOn(billingService, "getInvoice").mockResolvedValueOnce(mockInvoice as any);
      
      // Mock Stripe payment
      const mockStripeService = (billingService as any).stripe;
      mockStripeService.invoices.pay.mockResolvedValueOnce({ 
        payment_intent: "pi_123" 
      });
      
      mockQuery.mockResolvedValueOnce(undefined); // UPDATE invoice

      const result = await billingService.payInvoice("inv_123", "org_123", { 
        payment_method_id: "pm_123" 
      });

      expect(mockStripeService.invoices.pay).toHaveBeenCalledWith("stripe_inv_123", {
        payment_method: "pm_123"
      });
      
      expect(result.success).toBe(true);
      expect(result.payment_intent_id).toBe("pi_123");
    });

    it("should handle manual payment marking", async () => {
      const mockInvoice = { 
        id: "inv_123", 
        status: "open", 
        stripe_invoice_id: null 
      };
      
      jest.spyOn(billingService, "getInvoice").mockResolvedValueOnce(mockInvoice as any);
      mockQuery.mockResolvedValueOnce(undefined); // UPDATE invoice

      const result = await billingService.payInvoice("inv_123", "org_123", {});

      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE invoices SET status = $1, paid_at = NOW() WHERE id = $2",
        ["paid", "inv_123"]
      );
      
      expect(result.success).toBe(true);
      expect(result.message).toBe("Invoice marked as paid");
    });
  });

  describe("getInvoiceStats", () => {
    it("should calculate invoice statistics correctly", async () => {
      const mockStats = {
        total_invoices: "10",
        paid_invoices: "7", 
        open_invoices: "2",
        overdue_invoices: "1",
        total_amount: "1000.00",
        paid_amount: "700.00",
        overdue_amount: "100.00",
        average_invoice_value: "100.00",
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await billingService.getInvoiceStats("org_123", "30d");

      expect(result.total_invoices).toBe(10);
      expect(result.paid_invoices).toBe(7);
      expect(result.payment_rate).toBe(70); // 7/10 * 100
      expect(result.total_amount).toBe(1000);
      expect(result.paid_amount).toBe(700);
    });

    it("should handle different time periods", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{}] });

      await billingService.getInvoiceStats("org_123", "7d");

      const callArgs = mockQuery.mock.calls[0];
      const startDate = callArgs[1][1];
      const now = new Date();
      const expectedDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      expect(Math.abs(startDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
    });

    it("should return default stats on error", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      const result = await billingService.getInvoiceStats("org_123");

      expect(result.total_invoices).toBe(0);
      expect(result.payment_rate).toBe(0);
      expect(result.period).toBe("30d");
    });
  });

  describe("voidInvoice", () => {
    it("should void draft or open invoice", async () => {
      const mockInvoice = {
        id: "inv_123",
        status: "void",
        subtotal: "100.00",
        tax: "8.75", 
        total: "108.75",
        stripe_invoice_id: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockInvoice] });

      const result = await billingService.voidInvoice("inv_123", "org_123");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE invoices"),
        ["inv_123", "org_123"]
      );
      
      expect(result.status).toBe("void");
    });

    it("should handle Stripe invoice voiding", async () => {
      const mockInvoice = {
        id: "inv_123",
        status: "void", 
        stripe_invoice_id: "stripe_inv_123",
        subtotal: "100.00",
        tax: "8.75",
        total: "108.75",
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockInvoice] });
      
      const mockStripeService = (billingService as any).stripe;
      mockStripeService.invoices.voidInvoice.mockResolvedValueOnce({});

      await billingService.voidInvoice("inv_123", "org_123");

      expect(mockStripeService.invoices.voidInvoice).toHaveBeenCalledWith("stripe_inv_123");
    });
  });
});