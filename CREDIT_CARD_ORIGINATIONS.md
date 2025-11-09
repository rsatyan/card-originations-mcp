# Credit Card Originations MCP Server

A comprehensive Model Context Protocol (MCP) server that implements a complete credit card application and origination workflow.

## Overview

This MCP server provides tools for managing the entire credit card origination process, from initial application submission through card activation. The workflow is designed to simulate a real-world credit card application system with identity verification, credit checks, risk assessment, and decision-making capabilities.

## Features

- **Complete Application Workflow**: End-to-end credit card application process
- **Identity Verification**: KYC/AML compliance checks
- **Credit Assessment**: Credit score evaluation and history analysis
- **Risk Modeling**: Comprehensive risk assessment algorithms
- **Automated Decisioning**: Intelligent approval/denial with configurable overrides
- **Card Generation**: Luhn-compliant card number generation
- **Status Tracking**: Real-time application status monitoring

## Available Tools

### 1. submitApplication

Submit a new credit card application with applicant details.

**Parameters:**
- `firstName` (string): Applicant's first name
- `lastName` (string): Applicant's last name
- `email` (string): Email address
- `phone` (string): Phone number
- `dateOfBirth` (string): Date of birth (YYYY-MM-DD)
- `ssn` (string): Social Security Number (last 4 digits)
- `address` (object):
  - `street` (string)
  - `city` (string)
  - `state` (string)
  - `zipCode` (string)
- `employment` (object):
  - `status` (enum): employed, self-employed, unemployed, retired
  - `employer` (string, optional)
  - `jobTitle` (string, optional)
  - `yearsEmployed` (number, optional)
- `income` (object):
  - `annual` (number): Annual income in dollars
  - `source` (enum): salary, business, investments, retirement, other
- `housing` (object):
  - `status` (enum): own, rent, other
  - `monthlyPayment` (number)

**Returns:**
- Application ID
- Initial status
- Submission timestamp

### 2. verifyIdentity

Verify the identity of an applicant through government ID and KYC checks.

**Parameters:**
- `applicationId` (string): The application ID to verify
- `governmentIdType` (enum): drivers_license, passport, state_id
- `governmentIdNumber` (string): Government ID number
- `verificationMethod` (enum): automatic, manual, document_upload

**Returns:**
- Verification status (verified/failed)
- Verification score (0-100)
- Individual check results:
  - Document authenticity
  - Face match
  - SSN match
  - Address verification

### 3. checkCredit

Run a comprehensive credit check on the applicant.

**Parameters:**
- `applicationId` (string): The application ID
- `bureaus` (array, optional): Credit bureaus to check (defaults to all three: Experian, Equifax, TransUnion)

**Returns:**
- Credit score (300-850 FICO range)
- Score range classification (Poor/Fair/Good/Very Good/Exceptional)
- Credit history:
  - Open/closed accounts
  - Total credit limit and balance
  - Account age statistics
  - Hard inquiries
  - Delinquencies
  - Public records
- Credit utilization rate
- Risk factors identified

### 4. assessRisk

Perform a comprehensive risk assessment based on multiple factors.

**Parameters:**
- `applicationId` (string): The application ID

**Evaluation Factors:**
- Credit score (40% weight)
- Debt-to-income ratio (20% weight)
- Credit utilization (15% weight)
- Employment stability (10% weight)
- Delinquencies (10% weight)
- Public records (5% weight)

**Returns:**
- Risk score (0-100)
- Risk category (Low/Medium/High/Very High Risk)
- Recommendation (Approve/Manual Review/Deny)
- Detailed risk factors with individual impacts
- Debt-to-income ratio

### 5. makeDecision

Make a final approval or denial decision on the application.

**Parameters:**
- `applicationId` (string): The application ID
- `overrideDecision` (enum, optional): approve, deny, auto (default: auto)
- `manualReviewNotes` (string, optional): Notes from manual review

**Approval Logic:**
- Risk score ≥ 60: Automatic approval
- Risk score 40-59: Manual review zone (defaults to approval)
- Risk score < 40: Automatic denial

**Returns (if approved):**
- Credit limit (calculated based on income and credit score)
- APR (14.99% - 29.99% based on creditworthiness)
- Card tier (Standard/Standard Plus/Premium)
- Annual fee
- Rewards rate
- Grace period
- Late fee
- Foreign transaction fee

**Returns (if denied):**
- Denial reasons
- Specific adverse action details

### 6. activateCard

Activate an approved credit card and generate card details.

**Parameters:**
- `applicationId` (string): The application ID
- `cardDeliveryAddress` (object, optional): Delivery address (defaults to application address)
- `requestedPIN` (string, optional): 4-digit PIN (randomly generated if not provided)

**Returns:**
- Account number
- Masked card number (****-****-****-1234)
- Cardholder name
- Expiration date
- Card tier
- Card status
- Credit limit and available credit
- APR
- Delivery information

**Security Features:**
- Luhn algorithm-compliant card numbers
- Encrypted storage for sensitive data (CVV, PIN)
- Masked card number display

### 7. getApplicationStatus

Check the current status and details of any application.

**Parameters:**
- `applicationId` (string): The application ID
- `includeFullDetails` (boolean, optional): Include comprehensive details (default: false)

**Returns:**
- Current status
- Application progress checklist
- Next step recommendation
- Decision details (if available)
- Card details (if activated)
- Account information (if activated)

**Full Details Include:**
- All applicant information
- Identity verification results
- Complete credit check data
- Risk assessment breakdown
- Historical timeline

## Workflow Example

```javascript
// Step 1: Submit application
const app = await submitApplication({
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  phone: "555-0100",
  dateOfBirth: "1985-06-15",
  ssn: "1234",
  address: {
    street: "123 Main St",
    city: "New York",
    state: "NY",
    zipCode: "10001"
  },
  employment: {
    status: "employed",
    employer: "Tech Corp",
    jobTitle: "Software Engineer",
    yearsEmployed: 5
  },
  income: {
    annual: 95000,
    source: "salary"
  },
  housing: {
    status: "rent",
    monthlyPayment: 2000
  }
});
// Returns: { applicationId: "APP-1234567890-xyz..." }

// Step 2: Verify identity
await verifyIdentity({
  applicationId: app.applicationId,
  governmentIdType: "drivers_license",
  governmentIdNumber: "D1234567",
  verificationMethod: "automatic"
});

// Step 3: Check credit
await checkCredit({
  applicationId: app.applicationId,
  bureaus: ["experian", "equifax", "transunion"]
});

// Step 4: Assess risk
await assessRisk({
  applicationId: app.applicationId
});

// Step 5: Make decision
const decision = await makeDecision({
  applicationId: app.applicationId,
  overrideDecision: "auto"
});

// Step 6: Activate card (if approved)
if (decision.decision === "approved") {
  await activateCard({
    applicationId: app.applicationId,
    requestedPIN: "1234"
  });
}

// Check status anytime
await getApplicationStatus({
  applicationId: app.applicationId,
  includeFullDetails: true
});
```

## Application States

1. **submitted** - Initial application received
2. **identity_verified** - Identity verification passed
3. **identity_verification_failed** - Identity verification failed
4. **credit_checked** - Credit check completed
5. **risk_assessed** - Risk assessment completed
6. **approved** - Application approved, pending activation
7. **denied** - Application denied
8. **active** - Card activated and ready for use

## Risk Assessment Model

The risk assessment uses a weighted scoring system:

- **Credit Score (40%)**: Primary indicator of creditworthiness
  - Exceptional (800+): +5 points
  - Very Good (740-799): No impact
  - Good (670-739): -10 points
  - Fair (580-669): -25 points
  - Poor (<580): -40 points

- **Debt-to-Income Ratio (20%)**:
  - > 50%: -20 points
  - 35-50%: -10 points
  - < 35%: No impact

- **Credit Utilization (15%)**:
  - > 70%: -15 points
  - 50-70%: -8 points
  - < 50%: No impact

- **Employment (10%)**:
  - Unemployed: -10 points
  - < 1 year: -5 points
  - > 5 years: +3 points

- **Delinquencies (10%)**: -5 points each

- **Public Records (5%)**: -5 points if any

## Credit Decisioning

**Credit Limit Calculation:**
1. Base: 20% of annual income or $50,000 (whichever is lower)
2. Adjusted by credit score (0.4x to 1.5x multiplier)
3. Adjusted by risk score (proportional to score/100)
4. Rounded to nearest $500

**APR Calculation:**
- Base APR by credit score tier:
  - Exceptional (800+): 14.99%
  - Very Good (740-799): 17.99%
  - Good (670-739): 21.99%
  - Fair (580-669): 25.99%
  - Poor (<580): 29.99%
- +2% if risk score < 70

**Card Tier Assignment:**
- **Premium**: Credit score ≥ 740 AND credit limit ≥ $10,000
  - $95 annual fee
  - 2% cashback rewards
- **Standard Plus**: Credit score ≥ 670 AND credit limit ≥ $5,000
  - No annual fee
  - 1.5% cashback rewards
- **Standard**: All others
  - No annual fee
  - 1% cashback rewards

## Production Considerations

**Current Implementation (Simulation):**
- In-memory storage (Map)
- Simulated credit scores and histories
- Random verification results
- Mock card number generation

**For Production:**
1. **Database Integration**: Replace in-memory Map with persistent storage (PostgreSQL, MongoDB)
2. **Credit Bureau APIs**: Integrate with Experian, Equifax, TransUnion
3. **Identity Verification**: Integrate with Stripe Identity, Onfido, or Jumio
4. **Card Issuing**: Integrate with card issuing platform (e.g., Stripe Issuing, Marqeta)
5. **Compliance**: Implement FCRA, ECOA, and other regulatory requirements
6. **Security**:
   - Encrypt all PII and sensitive data
   - Implement proper access controls
   - Add audit logging
   - Use secure key management (HSM, KMS)
7. **Fraud Detection**: Add fraud scoring and monitoring
8. **Document Management**: Store and manage application documents
9. **Notifications**: Email/SMS notifications for status updates
10. **Adverse Action Notices**: Automated denial letter generation

## Security Notes

- All sensitive data (SSN, card numbers, CVV, PIN) should be encrypted at rest and in transit
- Implement proper authentication and authorization
- Follow PCI DSS compliance for card data handling
- Use secure random number generation for card details
- Implement rate limiting and fraud detection
- Log all access to sensitive data for audit purposes

## Testing

```bash
# Install dependencies
npm install

# Type check
npx tsc --noEmit

# Run development server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```

## License

See LICENSE file for details.
