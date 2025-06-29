
/* !!! This is code generated by Prisma. Do not edit directly. !!!
/* eslint-disable */

Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 6.8.2
 * Query Engine version: 2060c79ba17c6bb9f5823312b6f6b7f4a845738e
 */
Prisma.prismaVersion = {
  client: "6.8.2",
  engine: "2060c79ba17c6bb9f5823312b6f6b7f4a845738e"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.BillingSiteScalarFieldEnum = {
  id: 'id',
  name: 'name',
  domain: 'domain',
  organizationId: 'organizationId',
  createdAt: 'createdAt'
};

exports.Prisma.BillingOrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlanScalarFieldEnum = {
  id: 'id',
  name: 'name',
  displayName: 'displayName',
  description: 'description',
  priceMonthly: 'priceMonthly',
  priceYearly: 'priceYearly',
  currency: 'currency',
  isPublic: 'isPublic',
  sortOrder: 'sortOrder',
  stripeProductId: 'stripeProductId',
  stripeMonthlyPriceId: 'stripeMonthlyPriceId',
  stripeYearlyPriceId: 'stripeYearlyPriceId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlanFeatureScalarFieldEnum = {
  id: 'id',
  planId: 'planId',
  name: 'name',
  description: 'description',
  featureType: 'featureType',
  value: 'value',
  isHighlighted: 'isHighlighted',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlanLimitScalarFieldEnum = {
  id: 'id',
  planId: 'planId',
  resourceType: 'resourceType',
  maxValue: 'maxValue',
  overagePrice: 'overagePrice',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubscriptionScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  planId: 'planId',
  billingCycle: 'billingCycle',
  status: 'status',
  trialEndsAt: 'trialEndsAt',
  currentPeriodStart: 'currentPeriodStart',
  currentPeriodEnd: 'currentPeriodEnd',
  cancelsAtPeriodEnd: 'cancelsAtPeriodEnd',
  canceledAt: 'canceledAt',
  stripeSubscriptionId: 'stripeSubscriptionId',
  stripeCustomerId: 'stripeCustomerId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaymentMethodScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  stripePaymentMethodId: 'stripePaymentMethodId',
  brand: 'brand',
  last4: 'last4',
  expMonth: 'expMonth',
  expYear: 'expYear',
  isDefault: 'isDefault',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  subscriptionId: 'subscriptionId',
  stripeInvoiceId: 'stripeInvoiceId',
  number: 'number',
  currency: 'currency',
  subtotal: 'subtotal',
  tax: 'tax',
  total: 'total',
  status: 'status',
  invoicePdfUrl: 'invoicePdfUrl',
  periodStart: 'periodStart',
  periodEnd: 'periodEnd',
  dueDate: 'dueDate',
  paidAt: 'paidAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceItemScalarFieldEnum = {
  id: 'id',
  invoiceId: 'invoiceId',
  description: 'description',
  quantity: 'quantity',
  unitPrice: 'unitPrice',
  amount: 'amount',
  type: 'type',
  createdAt: 'createdAt'
};

exports.Prisma.UsageRecordScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  subscriptionId: 'subscriptionId',
  resourceType: 'resourceType',
  quantity: 'quantity',
  recordedAt: 'recordedAt'
};

exports.Prisma.UsageSummaryScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  subscriptionId: 'subscriptionId',
  resourceType: 'resourceType',
  periodStart: 'periodStart',
  periodEnd: 'periodEnd',
  includedQuantity: 'includedQuantity',
  usedQuantity: 'usedQuantity',
  overageQuantity: 'overageQuantity',
  overageUnitPrice: 'overageUnitPrice',
  overageAmount: 'overageAmount',
  status: 'status',
  stripeUsageRecordId: 'stripeUsageRecordId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BillingContactScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  email: 'email',
  name: 'name',
  phone: 'phone',
  companyName: 'companyName',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  city: 'city',
  state: 'state',
  postalCode: 'postalCode',
  country: 'country',
  vatNumber: 'vatNumber',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PromotionScalarFieldEnum = {
  id: 'id',
  code: 'code',
  description: 'description',
  discountType: 'discountType',
  discountValue: 'discountValue',
  duration: 'duration',
  durationMonths: 'durationMonths',
  maxRedemptions: 'maxRedemptions',
  redemptionCount: 'redemptionCount',
  validFrom: 'validFrom',
  validUntil: 'validUntil',
  stripePromotionCodeId: 'stripePromotionCodeId',
  stripeCouponId: 'stripeCouponId',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PromotionRedemptionScalarFieldEnum = {
  id: 'id',
  promotionId: 'promotionId',
  organizationId: 'organizationId',
  subscriptionId: 'subscriptionId',
  appliedAt: 'appliedAt'
};

exports.Prisma.PlanChangeRequestScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  currentPlanId: 'currentPlanId',
  requestedPlanId: 'requestedPlanId',
  changeType: 'changeType',
  requestedBy: 'requestedBy',
  reason: 'reason',
  status: 'status',
  processedBy: 'processedBy',
  processedAt: 'processedAt',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubscriptionHistoryScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  subscriptionId: 'subscriptionId',
  previousPlanId: 'previousPlanId',
  newPlanId: 'newPlanId',
  previousStatus: 'previousStatus',
  newStatus: 'newStatus',
  changeType: 'changeType',
  changeReason: 'changeReason',
  changedBy: 'changedBy',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};


exports.Prisma.ModelName = {
  BillingSite: 'BillingSite',
  BillingOrganization: 'BillingOrganization',
  Plan: 'Plan',
  PlanFeature: 'PlanFeature',
  PlanLimit: 'PlanLimit',
  Subscription: 'Subscription',
  PaymentMethod: 'PaymentMethod',
  Invoice: 'Invoice',
  InvoiceItem: 'InvoiceItem',
  UsageRecord: 'UsageRecord',
  UsageSummary: 'UsageSummary',
  BillingContact: 'BillingContact',
  Promotion: 'Promotion',
  PromotionRedemption: 'PromotionRedemption',
  PlanChangeRequest: 'PlanChangeRequest',
  SubscriptionHistory: 'SubscriptionHistory'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }

        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
