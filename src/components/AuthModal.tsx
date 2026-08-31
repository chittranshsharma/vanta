import { ShieldCheck } from "lucide-react";
import { useState, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Modal } from "./Modal";
import { signInWithEmail, signUpWithEmail } from "../lib/auth";

export function AuthModal({
  isOpen,
  onClose,
  mode,
  setMode,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: "signin" | "signup";
  setMode: (mode: "signin" | "signup") => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const signinTabRef = useRef<HTMLButtonElement>(null);
  const signupTabRef = useRef<HTMLButtonElement>(null);

  const handleTabKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      if (mode === "signin") {
        setMode("signup");
        setErrorMsg(null);
        signupTabRef.current?.focus();
      } else {
        setMode("signin");
        setErrorMsg(null);
        signinTabRef.current?.focus();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErrorMsg(null);

    if (mode === "signup") {
      const { error } = await signUpWithEmail(email.trim(), password, fullName.trim());
      setLoading(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        onSuccess();
      }
    } else {
      const { error } = await signInWithEmail(email.trim(), password);
      setLoading(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        onSuccess();
      }
    }
  };

  const isSubmitDisabled =
    loading ||
    !email.trim() ||
    !password.trim() ||
    (mode === "signup" && !fullName.trim());

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      ariaLabel={mode === "signin" ? "Sign in to Vanta" : "Create a Vanta account"}
      title={
        <span className="wordmark">
          <span className="wordmark-mark" /> Vanta
        </span>
      }
    >
      <div
        className="auth-tabs"
        role="tablist"
        aria-label="Authentication options"
      >
        <button
          ref={signinTabRef}
          role="tab"
          id="tab-signin"
          aria-selected={mode === "signin"}
          aria-controls="auth-panel"
          tabIndex={mode === "signin" ? 0 : -1}
          className={`auth-tab ${mode === "signin" ? "active" : ""}`}
          onClick={() => {
            setMode("signin");
            setErrorMsg(null);
          }}
          onKeyDown={handleTabKeyDown}
        >
          Sign In
        </button>
        <button
          ref={signupTabRef}
          role="tab"
          id="tab-signup"
          aria-selected={mode === "signup"}
          aria-controls="auth-panel"
          tabIndex={mode === "signup" ? 0 : -1}
          className={`auth-tab ${mode === "signup" ? "active" : ""}`}
          onClick={() => {
            setMode("signup");
            setErrorMsg(null);
          }}
          onKeyDown={handleTabKeyDown}
        >
          Create Account
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="auth-form"
        role="tabpanel"
        id="auth-panel"
        aria-labelledby={mode === "signin" ? "tab-signin" : "tab-signup"}
        aria-busy={loading}
      >
        {mode === "signup" && (
          <label htmlFor="auth-fullname">
            Full Name
            <input
              id="auth-fullname"
              type="text"
              required
              placeholder="Alex Morgan"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              disabled={loading}
              autoComplete="name"
              aria-required="true"
              aria-invalid={!!errorMsg}
              aria-describedby={errorMsg ? "auth-error" : undefined}
            />
          </label>
        )}

        <label htmlFor="auth-email">
          Email Address
          <input
            id="auth-email"
            type="email"
            required
            placeholder="alex@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            disabled={loading}
            autoComplete="email"
            aria-required="true"
            aria-invalid={!!errorMsg}
            aria-describedby={errorMsg ? "auth-error" : undefined}
          />
        </label>

        <label htmlFor="auth-password">
          Password
          <input
            id="auth-password"
            type="password"
            required
            minLength={6}
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            disabled={loading}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            aria-required="true"
            aria-invalid={!!errorMsg}
            aria-describedby={errorMsg ? "auth-error" : undefined}
          />
        </label>

        {errorMsg && (
          <div className="error-text" role="alert" id="auth-error" aria-live="assertive">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          className="primary-button w-full"
          disabled={isSubmitDisabled}
          aria-busy={loading}
        >
          {loading ? "Verifying..." : mode === "signin" ? "Sign In to Workspace" : "Create Account"}
        </button>
      </form>

      <div className="auth-footer">
        <ShieldCheck size={14} />
        <span>Tenant-scoped by design · Row-Level Security architecture</span>
      </div>
    </Modal>
  );
}
