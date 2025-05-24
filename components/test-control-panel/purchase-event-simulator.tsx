"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Minus, ShoppingCart, User, MapPin } from "lucide-react";

interface Product {
  id: string;
  title: string;
  price: string;
  quantity: number;
  image?: string;
}

interface Customer {
  email: string;
  first_name: string;
  last_name: string;
  city?: string;
  country?: string;
}

interface PurchaseEventData {
  customer: Customer;
  products: Product[];
  currency: string;
  total_price: string;
}

interface PurchaseEventSimulatorProps {
  testSite?: {
    id: string;
    name: string;
    shop_domain: string;
  };
  onEventSent?: (success: boolean, message: string) => void;
}

const SAMPLE_PRODUCTS = [
  { title: "Blue Cotton T-Shirt", price: "29.99" },
  { title: "Wireless Headphones", price: "89.99" },
  { title: "Coffee Mug", price: "14.99" },
  { title: "Laptop Stand", price: "49.99" },
  { title: "Phone Case", price: "19.99" },
];

const SAMPLE_CUSTOMERS = [
  {
    first_name: "John",
    last_name: "Doe",
    email: "john.doe@example.com",
    city: "New York",
    country: "United States",
  },
  {
    first_name: "Sarah",
    last_name: "Johnson",
    email: "sarah.j@example.com",
    city: "London",
    country: "United Kingdom",
  },
  {
    first_name: "Mike",
    last_name: "Chen",
    email: "mike.chen@example.com",
    city: "Toronto",
    country: "Canada",
  },
  {
    first_name: "Emma",
    last_name: "Wilson",
    email: "emma.w@example.com",
    city: "Sydney",
    country: "Australia",
  },
];

const CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
];

export default function PurchaseEventSimulator({
  testSite,
  onEventSent,
}: PurchaseEventSimulatorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [eventData, setEventData] = useState<PurchaseEventData>({
    customer: {
      email: "",
      first_name: "",
      last_name: "",
      city: "",
      country: "",
    },
    products: [
      {
        id: "1",
        title: "",
        price: "",
        quantity: 1,
      },
    ],
    currency: "USD",
    total_price: "0.00",
  });

  const [errors, setErrors] = useState<string[]>([]);

  // Calculate total price based on products
  const calculateTotal = (products: Product[]): string => {
    const total = products.reduce((sum, product) => {
      const price = parseFloat(product.price) || 0;
      return sum + price * product.quantity;
    }, 0);
    return total.toFixed(2);
  };

  // Update total when products change
  const updateProducts = (products: Product[]) => {
    const total = calculateTotal(products);
    setEventData((prev) => ({
      ...prev,
      products,
      total_price: total,
    }));
  };

  const addProduct = () => {
    const newProduct: Product = {
      id: (eventData.products.length + 1).toString(),
      title: "",
      price: "",
      quantity: 1,
    };
    updateProducts([...eventData.products, newProduct]);
  };

  const removeProduct = (index: number) => {
    if (eventData.products.length > 1) {
      const newProducts = eventData.products.filter((_, i) => i !== index);
      updateProducts(newProducts);
    }
  };

  const updateProduct = (index: number, field: keyof Product, value: string | number) => {
    const newProducts = [...eventData.products];
    newProducts[index] = { ...newProducts[index], [field]: value };
    updateProducts(newProducts);
  };

  const fillSampleData = () => {
    const randomCustomer = SAMPLE_CUSTOMERS[Math.floor(Math.random() * SAMPLE_CUSTOMERS.length)];
    const randomProduct = SAMPLE_PRODUCTS[Math.floor(Math.random() * SAMPLE_PRODUCTS.length)];

    const sampleData: PurchaseEventData = {
      customer: randomCustomer,
      products: [
        {
          id: "1",
          title: randomProduct.title,
          price: randomProduct.price,
          quantity: Math.floor(Math.random() * 3) + 1,
        },
      ],
      currency: "USD",
      total_price: "0.00",
    };

    sampleData.total_price = calculateTotal(sampleData.products);
    setEventData(sampleData);
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    // Validate customer
    if (!eventData.customer.email) newErrors.push("Customer email is required");
    if (!eventData.customer.first_name) newErrors.push("Customer first name is required");

    // Validate products
    if (eventData.products.length === 0) {
      newErrors.push("At least one product is required");
    } else {
      eventData.products.forEach((product, index) => {
        if (!product.title) newErrors.push(`Product ${index + 1} title is required`);
        if (!product.price || parseFloat(product.price) <= 0) {
          newErrors.push(`Product ${index + 1} must have a valid price`);
        }
        if (product.quantity <= 0) {
          newErrors.push(`Product ${index + 1} quantity must be greater than 0`);
        }
      });
    }

    // Validate test site
    if (!testSite) {
      newErrors.push("Test site is not configured");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const sendEvent = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors([]);

    try {
      const response = await fetch("/api/test-control-panel/simulate-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop_domain: testSite!.shop_domain,
          order_data: eventData,
        }),
      });

      const result = await response.json();

      if (result.success) {
        onEventSent?.(true, "Purchase event sent successfully!");
      } else {
        onEventSent?.(false, result.error || "Failed to send event");
      }
    } catch (error: any) {
      console.error("Error sending event:", error);
      onEventSent?.(false, "Network error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (!testSite) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Purchase Event Simulator</CardTitle>
          <CardDescription>
            Test site must be configured before you can simulate events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Please initialize your test site in the Settings tab first.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ShoppingCart className="h-5 w-5" />
          <span>Purchase Event Simulator</span>
        </CardTitle>
        <CardDescription>Simulate Shopify purchase events for {testSite.name}</CardDescription>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">Shop: {testSite.shop_domain}</Badge>
          <Button
            variant="primary"
            size="sm"
            onClick={fillSampleData}
          >
            Fill Sample Data
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              <ul className="list-inside list-disc space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Customer Information */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <h3 className="text-lg font-medium">Customer Information</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={eventData.customer.first_name}
                onChange={(e) =>
                  setEventData((prev) => ({
                    ...prev,
                    customer: { ...prev.customer, first_name: e.target.value },
                  }))
                }
                placeholder="John"
              />
            </div>
            <div>
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={eventData.customer.last_name}
                onChange={(e) =>
                  setEventData((prev) => ({
                    ...prev,
                    customer: { ...prev.customer, last_name: e.target.value },
                  }))
                }
                placeholder="Doe"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={eventData.customer.email}
                onChange={(e) =>
                  setEventData((prev) => ({
                    ...prev,
                    customer: { ...prev.customer, email: e.target.value },
                  }))
                }
                placeholder="john.doe@example.com"
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={eventData.customer.city}
                onChange={(e) =>
                  setEventData((prev) => ({
                    ...prev,
                    customer: { ...prev.customer, city: e.target.value },
                  }))
                }
                placeholder="New York"
              />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={eventData.customer.country}
                onChange={(e) =>
                  setEventData((prev) => ({
                    ...prev,
                    customer: { ...prev.customer, country: e.target.value },
                  }))
                }
                placeholder="United States"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Products */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-4 w-4" />
              <h3 className="text-lg font-medium">Products</h3>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={addProduct}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Product
            </Button>
          </div>

          {eventData.products.map((product, index) => (
            <Card
              key={product.id}
              className="p-4"
            >
              <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Label htmlFor={`product-title-${index}`}>Product Title *</Label>
                  <Input
                    id={`product-title-${index}`}
                    value={product.title}
                    onChange={(e) => updateProduct(index, "title", e.target.value)}
                    placeholder="Blue Cotton T-Shirt"
                  />
                </div>
                <div>
                  <Label htmlFor={`product-price-${index}`}>Price *</Label>
                  <Input
                    id={`product-price-${index}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={product.price}
                    onChange={(e) => updateProduct(index, "price", e.target.value)}
                    placeholder="29.99"
                  />
                </div>
                <div>
                  <Label htmlFor={`product-quantity-${index}`}>Quantity</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id={`product-quantity-${index}`}
                      type="number"
                      min="1"
                      value={product.quantity}
                      onChange={(e) =>
                        updateProduct(index, "quantity", parseInt(e.target.value) || 1)
                      }
                      className="flex-1"
                    />
                    {eventData.products.length > 1 && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => removeProduct(index)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Order Summary */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Order Summary</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={eventData.currency}
                onValueChange={(value) => setEventData((prev) => ({ ...prev, currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem
                      key={currency.code}
                      value={currency.code}
                    >
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Total Price</Label>
              <div className="text-2xl font-bold text-green-600">
                {eventData.currency} {eventData.total_price}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Send Event */}
        <div className="flex justify-center">
          <Button
            onClick={sendEvent}
            disabled={isLoading}
            size="lg"
            className="w-full md:w-auto"
          >
            {isLoading ?
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Event...
              </>
            : <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Send Purchase Event
              </>
            }
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
