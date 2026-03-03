import React, { useState, useEffect, useCallback, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import ui from "../styles/primitives.module.scss";
import { Button } from "./Button";
import type { TripleAApiClient } from "../api/client";

/** Scroll to the first error field with a smooth animation */
function scrollToFirstError(errors: Record<string, string>) {
  const firstErrorKey = Object.keys(errors)[0];
  if (!firstErrorKey) return;

  const selectorForKey =
    firstErrorKey === "dob" ? "[name='dobMonth']" : `[name='${firstErrorKey}']`;

  const target =
    firstErrorKey === "bankAccount"
      ? document.querySelector<HTMLElement>("[data-field='bankAccount']")
      : document.querySelector<HTMLElement>(selectorForKey);

  if (!target) return;

  // Prefer scrolling the containing field wrapper for consistent layout.
  const field = target.closest('[class*="field"]') ?? target;
  field.scrollIntoView({ behavior: "smooth", block: "center" });

  // Also focus the element (when possible) for accessibility.
  try {
    target.focus();
  } catch {
    // ignore
  }
}

interface StripeOnboardingFormProps {
  accountId: string;
  apiClient: TripleAApiClient;
  onSuccess: () => void;
  onValidationChange?: (isValid: boolean) => void;
  onSubmitReady?: (submitFn: () => Promise<void>) => void;
}

export function StripeOnboardingForm({
  accountId,
  apiClient,
  onSuccess: _onSuccess,
  onValidationChange,
  onSubmitReady,
}: StripeOnboardingFormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Refs help capture browser autofill values that may not trigger React events.
  const firstNameRef = useRef<HTMLInputElement | null>(null);
  const lastNameRef = useRef<HTMLInputElement | null>(null);
  const dobMonthRef = useRef<HTMLInputElement | null>(null);
  const dobDayRef = useRef<HTMLInputElement | null>(null);
  const dobYearRef = useRef<HTMLInputElement | null>(null);
  const ssnLast4Ref = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const addressLine1Ref = useRef<HTMLInputElement | null>(null);
  const addressLine2Ref = useRef<HTMLInputElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
  const stateRef = useRef<HTMLInputElement | null>(null);
  const postalCodeRef = useRef<HTMLInputElement | null>(null);

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

  // Bank account token from Financial Connections (btok_...)
  const [bankAccountToken, setBankAccountToken] = useState("");
  const [bankLinked, setBankLinked] = useState(false);
  const [showBankLink, setShowBankLink] = useState(false);
  const [bankDetails, setBankDetails] = useState<{
    bankName: string;
    last4: string;
  } | null>(null);

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

      const { clientSecret } =
        await apiClient.createFinancialConnectionsSession(accountId);

      const stripe = await loadStripe(pubKey);
      if (!stripe) {
        throw new Error("Failed to load Stripe");
      }

      setBusy(false);

      const { token, error: fcError } = await stripe.collectBankAccountToken({
        clientSecret,
      });

      if (fcError) {
        throw new Error(fcError.message);
      }

      if (token?.id && token.bank_account) {
        setBankAccountToken(token.id);
        setBankDetails({
          bankName: token.bank_account.bank_name || "Bank",
          last4: token.bank_account.last4 || "",
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

    // Read current DOM values first (autofill can bypass onChange), then sync state.
    const firstNameValue = (firstNameRef.current?.value ?? firstName).trim();
    const lastNameValue = (lastNameRef.current?.value ?? lastName).trim();
    const dobMonthValue = (dobMonthRef.current?.value ?? dobMonth).trim();
    const dobDayValue = (dobDayRef.current?.value ?? dobDay).trim();
    const dobYearValue = (dobYearRef.current?.value ?? dobYear).trim();
    const ssnLast4Value = (ssnLast4Ref.current?.value ?? ssnLast4).trim();
    const phoneValue = (phoneRef.current?.value ?? phone).trim();
    const addressLine1Value = (
      addressLine1Ref.current?.value ?? addressLine1
    ).trim();
    const addressLine2Value = (
      addressLine2Ref.current?.value ?? addressLine2
    ).trim();
    const cityValue = (cityRef.current?.value ?? city).trim();
    const stateValue = (stateRef.current?.value ?? state).trim();
    const postalCodeValue = (postalCodeRef.current?.value ?? postalCode).trim();

    // Keep controlled inputs in sync so a validation re-render doesn't wipe autofill.
    if (firstNameValue !== firstName) setFirstName(firstNameValue);
    if (lastNameValue !== lastName) setLastName(lastNameValue);
    if (dobMonthValue !== dobMonth) setDobMonth(dobMonthValue);
    if (dobDayValue !== dobDay) setDobDay(dobDayValue);
    if (dobYearValue !== dobYear) setDobYear(dobYearValue);
    if (ssnLast4Value !== ssnLast4) setSsnLast4(ssnLast4Value);
    if (phoneValue !== phone) setPhone(phoneValue);
    if (addressLine1Value !== addressLine1) setAddressLine1(addressLine1Value);
    if (addressLine2Value !== addressLine2) setAddressLine2(addressLine2Value);
    if (cityValue !== city) setCity(cityValue);
    if (stateValue !== state) setState(stateValue);
    if (postalCodeValue !== postalCode) setPostalCode(postalCodeValue);

    const errors: Record<string, string> = {};

    if (!firstNameValue) errors.firstName = "First name is required";
    if (!lastNameValue) errors.lastName = "Last name is required";
    if (!dobDayValue || !dobMonthValue || !dobYearValue) {
      errors.dob = "Date of birth is required";
    } else {
      const day = parseInt(dobDayValue);
      const month = parseInt(dobMonthValue);
      const year = parseInt(dobYearValue);
      if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) {
        errors.dob = "Invalid date of birth";
      }
    }

    if (!ssnLast4Value) {
      errors.ssnLast4 = "SSN last 4 is required";
    } else if (!/^\d{4}$/.test(ssnLast4Value)) {
      errors.ssnLast4 = "Must be exactly 4 digits";
    }

    if (!phoneValue) {
      errors.phone = "Phone number is required";
    } else if (phoneValue.length < 10) {
      errors.phone = "Invalid phone number";
    }

    if (!addressLine1Value) errors.addressLine1 = "Street address is required";
    if (!cityValue) errors.city = "City is required";
    if (!stateValue) errors.state = "State is required";
    if (!postalCodeValue) errors.postalCode = "ZIP code is required";

    if (!bankAccountToken) {
      errors.bankAccount = "Please link your bank account";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Scroll to first error after state update renders the error messages
      setTimeout(() => scrollToFirstError(errors), 100);
      throw new Error("Please complete all required fields");
    }

    setBusy(true);
    try {
      const submitRes = await apiClient.submitMusicianOnboarding({
        firstName: firstNameValue,
        lastName: lastNameValue,
        dob: { day: dobDayValue, month: dobMonthValue, year: dobYearValue },
        ssnLast4: ssnLast4Value,
        phone: phoneValue,
        address: {
          line1: addressLine1Value,
          line2: addressLine2Value || undefined,
          city: cityValue,
          state: stateValue,
          postal_code: postalCodeValue,
        },
        bankAccountToken,
      });

      // If submission succeeded, invoke onSuccess handler
      if (submitRes?.success) {
        try {
          _onSuccess();
        } catch (e) {
          // ignore errors from callback
        }
      }
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

  const submitFnRef = useRef(validateAndSubmit);
  useEffect(() => {
    submitFnRef.current = validateAndSubmit;
  }, [validateAndSubmit]);

  useEffect(() => {
    if (onSubmitReady) {
      onSubmitReady(() => submitFnRef.current());
    }
  }, [onSubmitReady]);

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
              name="firstName"
              ref={firstNameRef}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
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
              name="lastName"
              ref={lastNameRef}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
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
                name="dobMonth"
                ref={dobMonthRef}
                placeholder="MM"
                value={dobMonth}
                onChange={(e) => setDobMonth(e.target.value)}
                maxLength={2}
                style={{ flex: 1 }}
                autoComplete="bday-month"
              />
              <input
                type="text"
                className={ui.input}
                name="dobDay"
                ref={dobDayRef}
                placeholder="DD"
                value={dobDay}
                onChange={(e) => setDobDay(e.target.value)}
                maxLength={2}
                style={{ flex: 1 }}
                autoComplete="bday-day"
              />
              <input
                type="text"
                className={ui.input}
                name="dobYear"
                ref={dobYearRef}
                placeholder="YYYY"
                value={dobYear}
                onChange={(e) => setDobYear(e.target.value)}
                maxLength={4}
                style={{ flex: 2 }}
                autoComplete="bday-year"
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  color: "var(--text-muted)",
                  letterSpacing: "0.02em",
                  fontFamily: "monospace",
                  lineHeight: 1,
                  transform: "translateY(1.5px)",
                  display: "inline-block",
                }}
              >
                ••• ••
              </span>
              <input
                type="text"
                name="ssnLast4"
                ref={ssnLast4Ref}
                inputMode="numeric"
                pattern="\\d*"
                aria-label="Last 4 digits of SSN"
                value={ssnLast4}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setSsnLast4(digits);
                }}
                maxLength={4}
                placeholder="____"
                autoComplete="off"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  padding: 0,
                  fontFamily: "inherit",
                }}
              />
            </div>
            {fieldErrors.ssnLast4 ? (
              <p
                className={ui.error}
                style={{ marginTop: 4, fontSize: "13px" }}
              >
                {fieldErrors.ssnLast4}
              </p>
            ) : (
              <p className={ui.help} style={{ marginTop: 4 }}>
                Used for tax reporting (last 4 digits of SSN)
              </p>
            )}
          </div>

          <div className={ui.field}>
            <label className={ui.label}>Phone number</label>
            <input
              type="tel"
              className={ui.input}
              name="phone"
              ref={phoneRef}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              autoComplete="tel"
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
              name="addressLine1"
              ref={addressLine1Ref}
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              autoComplete="address-line1"
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
              name="addressLine2"
              ref={addressLine2Ref}
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
            />
          </div>

          <div className={ui.field}>
            <label className={ui.label}>City</label>
            <input
              type="text"
              className={ui.input}
              name="city"
              ref={cityRef}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="address-level2"
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
                name="state"
                ref={stateRef}
                value={state}
                onChange={(e) => setState(e.target.value)}
                maxLength={2}
                placeholder="CA"
                autoComplete="address-level1"
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
                name="postalCode"
                ref={postalCodeRef}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                maxLength={5}
                autoComplete="postal-code"
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
            {/*
              Note: Financial Connections opens a Stripe-hosted modal which is
              controlled by Stripe. We can style this trigger button, but the
              popup UI itself cannot be reliably themed from our app.
            */}
            <Button
              type="button"
              data-field="bankAccount"
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

      <div style={{ textAlign: "right", marginTop: 8 }}>
        <a
          href="https://stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--text-muted)",
            textDecoration: "none",
            fontSize: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 13 }}>🔒</span>
          <span>Secured with Stripe</span>
        </a>
      </div>
    </div>
  );
}
