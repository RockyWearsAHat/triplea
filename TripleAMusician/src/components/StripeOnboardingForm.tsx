import React, { useState, useEffect, useCallback, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { createApiClient } from "../lib/urls";
import ui from "../../../packages/shared/src/styles/primitives.module.scss";
import { Button } from "../../../packages/shared/src/components/Button";

interface StripeOnboardingFormProps {
  accountId: string;
  onSuccess: () => void;
  onValidationChange?: (isValid: boolean) => void;
  onSubmitReady?: (submitFn: () => Promise<void>) => void;
}

export function StripeOnboardingForm({
  accountId,
  onSuccess,
  onValidationChange,
  onSubmitReady,
}: StripeOnboardingFormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Personal info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [ssnLast4, setSsnLast4] = useState("");
  const [phone, setPhone] = useState("");

  // Address
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Bank account token from Financial Connections
  const [bankAccountToken, setBankAccountToken] = useState("");
  const [bankLinked, setBankLinked] = useState(false);
  const [showBankLink, setShowBankLink] = useState(false);
  const [bankDetails, setBankDetails] = useState<{
    bankName: string;
    last4: string;
    accountType?: string;
  } | null>(null);

  const apiClient = createApiClient();

  useEffect(() => {
    if (showBankLink) {
      initializeBankLinking();
    }
  }, [showBankLink]);

  const initializeBankLinking = async () => {
    setBusy(true);
    setError("");
    try {
      const pubKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (!pubKey) {
        throw new Error("Stripe publishable key not configured");
      }

      // Get client secret for Financial Connections
      const { clientSecret } =
        await apiClient.createFinancialConnectionsSession(accountId);

      // Load Stripe.js
      const stripe = await loadStripe(pubKey);
      if (!stripe) {
        throw new Error("Failed to load Stripe");
      }

      setBusy(false);

      // Collect Financial Connections account
      const { financialConnectionsSession, error: fcError } =
        await stripe.collectFinancialConnectionsAccounts({
          clientSecret,
        });

      if (fcError) {
        throw new Error(fcError.message);
      }

      if (financialConnectionsSession?.accounts?.[0]) {
        const account = financialConnectionsSession.accounts[0];
        setBankAccountToken(account.id);
        setBankDetails({
          bankName: account.display_name || account.institution_name || "Bank",
          last4: account.last4 || "",
          accountType: account.subcategory,
        });
        setBankLinked(true);
        setShowBankLink(false);
      } else {
        throw new Error("No bank account was linked");
      }
    } catch (err: any) {
      setError(err.message || "Failed to link bank account");
      setBusy(false);
      setShowBankLink(false);
    }
  };

  const validateAndSubmit = useCallback(async () => {
    setError("");
    setFieldErrors({});

    const errors: Record<string, string> = {};

    // Basic validation
    if (!firstName) errors.firstName = "First name is required";
    if (!lastName) errors.lastName = "Last name is required";
    if (!dobDay || !dobMonth || !dobYear) {
      errors.dob = "Date of birth is required";
    } else {
      // Validate DOB
      const day = parseInt(dobDay);
      const month = parseInt(dobMonth);
      const year = parseInt(dobYear);

      if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) {
        errors.dob = "Invalid date of birth";
      }
    }

    // Validate SSN last 4
    if (!ssnLast4) {
      errors.ssnLast4 = "SSN last 4 is required";
    } else if (!/^\d{4}$/.test(ssnLast4)) {
      errors.ssnLast4 = "Must be exactly 4 digits";
    }

    // Validate phone
    if (!phone) {
      errors.phone = "Phone number is required";
    } else if (phone.length < 10) {
      errors.phone = "Invalid phone number";
    }

    // Validate address
    if (!addressLine1) errors.addressLine1 = "Street address is required";
    if (!city) errors.city = "City is required";
    if (!state) errors.state = "State is required";
    if (!postalCode) errors.postalCode = "ZIP code is required";

    // Validate bank account
    if (!bankAccountToken) {
      errors.bankAccount = "Please link your bank account";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      throw new Error("Please complete all required Stripe onboarding fields");
    }

    setBusy(true);
    try {
      await apiClient.submitMusicianOnboarding({
        firstName,
        lastName,
        dob: { day: dobDay, month: dobMonth, year: dobYear },
        ssnLast4,
        phone,
        address: {
          line1: addressLine1,
          line2: addressLine2 || undefined,
          city,
          state,
          postal_code: postalCode,
        },
        bankAccountToken,
      });
    } finally {
      setBusy(false);
    }
  }, [
    firstName,
    lastName,
    dobDay,
    dobMonth,
    dobYear,
    ssnLast4,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    bankAccountToken,
    apiClient,
  ]);

  // Store the latest submit function in a ref
  const submitFnRef = useRef(validateAndSubmit);
  useEffect(() => {
    submitFnRef.current = validateAndSubmit;
  }, [validateAndSubmit]);

  // Expose submit function to parent (only once)
  useEffect(() => {
    if (onSubmitReady) {
      onSubmitReady(() => submitFnRef.current());
    }
  }, [onSubmitReady]);

  // Notify parent of validation state
  useEffect(() => {
    if (onValidationChange) {
      const isValid =
        !!firstName &&
        !!lastName &&
        !!dobDay &&
        !!dobMonth &&
        !!dobYear &&
        !!ssnLast4 &&
        /^\d{4}$/.test(ssnLast4) &&
        !!phone &&
        phone.length >= 10 &&
        !!addressLine1 &&
        !!city &&
        !!state &&
        !!postalCode &&
        !!bankAccountToken;
      onValidationChange(isValid);
    }
  }, [
    firstName,
    lastName,
    dobDay,
    dobMonth,
    dobYear,
    ssnLast4,
    phone,
    addressLine1,
    city,
    state,
    postalCode,
    bankAccountToken,
  ]);

  return (
    <div
      className={ui.stack}
      style={{ "--stack-gap": "24px", maxWidth: 600 } as React.CSSProperties}
    >
      <div>
        <h3 className={ui.sectionTitle}>Personal Information</h3>
        <div
          className={ui.stack}
          style={
            { "--stack-gap": "12px", marginTop: 12 } as React.CSSProperties
          }
        >
          <div className={ui.field}>
            <label className={ui.label}>Legal first name</label>
            <input
              type="text"
              className={ui.input}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            {fieldErrors.firstName && (
              <p
                className={ui.error}
                style={{ marginTop: 4, fontSize: "13px" }}
              >
                {fieldErrors.firstName}
              </p>
            )}
          </div>

          <div className={ui.field}>
            <label className={ui.label}>Legal last name</label>
            <input
              type="text"
              className={ui.input}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
            {fieldErrors.lastName && (
              <p
                className={ui.error}
                style={{ marginTop: 4, fontSize: "13px" }}
              >
                {fieldErrors.lastName}
              </p>
            )}
          </div>

          <div className={ui.field}>
            <label className={ui.label}>Date of birth</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                className={ui.input}
                placeholder="MM"
                value={dobMonth}
                onChange={(e) => setDobMonth(e.target.value)}
                maxLength={2}
                style={{ flex: 1 }}
                required
              />
              <input
                type="text"
                className={ui.input}
                placeholder="DD"
                value={dobDay}
                onChange={(e) => setDobDay(e.target.value)}
                maxLength={2}
                style={{ flex: 1 }}
                required
              />
              <input
                type="text"
                className={ui.input}
                placeholder="YYYY"
                value={dobYear}
                onChange={(e) => setDobYear(e.target.value)}
                maxLength={4}
                style={{ flex: 2 }}
                required
              />
            </div>
            {fieldErrors.dob ? (
              <p
                className={ui.error}
                style={{ marginTop: 4, fontSize: "13px" }}
              >
                {fieldErrors.dob}
              </p>
            ) : (
              <p className={ui.help} style={{ marginTop: 4 }}>
                You must be 18 or older
              </p>
            )}
          </div>

          <div className={ui.field}>
            <label className={ui.label}>Last 4 digits of SSN</label>
            <input
              type="text"
              className={ui.input}
              value={ssnLast4}
              onChange={(e) => setSsnLast4(e.target.value)}
              maxLength={4}
              placeholder="1234"
              required
            />
            {fieldErrors.ssnLast4 ? (
              <p
                className={ui.error}
                style={{ marginTop: 4, fontSize: "13px" }}
              >
                {fieldErrors.ssnLast4}
              </p>
            ) : (
              <p className={ui.help} style={{ marginTop: 4 }}>
                Required for tax reporting (1099)
              </p>
            )}
          </div>

          <div className={ui.field}>
            <label className={ui.label}>Phone number</label>
            <input
              type="tel"
              className={ui.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              required
            />
            {fieldErrors.phone && (
              <p
                className={ui.error}
                style={{ marginTop: 4, fontSize: "13px" }}
              >
                {fieldErrors.phone}
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className={ui.sectionTitle}>Home Address</h3>
        <div
          className={ui.stack}
          style={
            { "--stack-gap": "12px", marginTop: 12 } as React.CSSProperties
          }
        >
          <div className={ui.field}>
            <label className={ui.label}>Street address</label>
            <input
              type="text"
              className={ui.input}
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              required
            />
            {fieldErrors.addressLine1 && (
              <p
                className={ui.error}
                style={{ marginTop: 4, fontSize: "13px" }}
              >
                {fieldErrors.addressLine1}
              </p>
            )}
          </div>

          <div className={ui.field}>
            <label className={ui.label}>
              Apartment, suite, etc. (optional)
            </label>
            <input
              type="text"
              className={ui.input}
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
            />
          </div>

          <div className={ui.field}>
            <label className={ui.label}>City</label>
            <input
              type="text"
              className={ui.input}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
            {fieldErrors.city && (
              <p
                className={ui.error}
                style={{ marginTop: 4, fontSize: "13px" }}
              >
                {fieldErrors.city}
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div className={ui.field} style={{ flex: 1 }}>
              <label className={ui.label}>State</label>
              <input
                type="text"
                className={ui.input}
                value={state}
                onChange={(e) => setState(e.target.value)}
                maxLength={2}
                placeholder="CA"
                required
              />
              {fieldErrors.state && (
                <p
                  className={ui.error}
                  style={{ marginTop: 4, fontSize: "13px" }}
                >
                  {fieldErrors.state}
                </p>
              )}
            </div>

            <div className={ui.field} style={{ flex: 1 }}>
              <label className={ui.label}>ZIP code</label>
              <input
                type="text"
                className={ui.input}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                maxLength={5}
                required
              />
              {fieldErrors.postalCode && (
                <p
                  className={ui.error}
                  style={{ marginTop: 4, fontSize: "13px" }}
                >
                  {fieldErrors.postalCode}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className={ui.sectionTitle}>Bank Account</h3>
        <p className={ui.help} style={{ marginTop: 4, marginBottom: 16 }}>
          Link your bank account securely to receive payments
        </p>
        {bankLinked && bankDetails ? (
          <div className={ui.field}>
            <div
              style={{
                padding: "16px",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  flexShrink: 0,
                }}
              >
                🏦
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: "var(--text-base)" }}>
                  {bankDetails.bankName}
                </div>
                <div className={ui.help} style={{ marginTop: 2 }}>
                  {bankDetails.accountType ? `${bankDetails.accountType} ` : ""}
                  {bankDetails.last4 ? `••••${bankDetails.last4}` : "Connected"}
                </div>
              </div>
              <div
                style={{
                  color: "var(--text-success)",
                  fontSize: "20px",
                  flexShrink: 0,
                }}
              >
                ✓
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setBankLinked(false);
                setBankAccountToken("");
                setBankDetails(null);
              }}
              style={{
                marginTop: "8px",
                background: "none",
                border: "none",
                color: "var(--text-dim)",
                fontSize: "13px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Change bank account
            </button>
          </div>
        ) : (
          <>
            <Button
              type="button"
              onClick={() => setShowBankLink(true)}
              disabled={busy}
              style={{ width: "100%" }}
            >
              {busy ? "Loading..." : "Link Bank Account"}
            </Button>
            {fieldErrors.bankAccount && (
              <p
                className={ui.error}
                style={{ marginTop: 8, fontSize: "13px" }}
              >
                {fieldErrors.bankAccount}
              </p>
            )}
          </>
        )}
      </div>

      {error && (
        <div className={ui.error} style={{ fontSize: "14px", padding: "12px" }}>
          {error}
        </div>
      )}

      <p className={ui.help} style={{ textAlign: "center" }}>
        <a
          href="https://stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--text-base)", textDecoration: "underline" }}
        >
          Protected by Stripe
        </a>
      </p>
    </div>
  );
}
