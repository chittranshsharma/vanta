import { ShieldCheck } from "lucide-react";
import { useState } from "react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    if (mode === "signup") {
      const { error } = await signUpWithEmail(email, password, fullName);
      setLoading(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        onSuccess();
      }
    } else {
      const { error } = await signInWithEmail(email, password);
      setLoading(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        onSuccess();
      }
    }
  };

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
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "signin" ? "active" : ""}`}
            onClick={() => {
              setMode("signin");
              setErrorMsg(null);
            }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => {
              setMode("signup");
              setErrorMsg(null);
            }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <label>
              Full Name
              <input
                type="text"
                required
                placeholder="Alex Morgan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
          )}

          <label>
            Email Address
            <input
              type="email"
              required
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {errorMsg && <p className="error-text">{errorMsg}</p>}

          <button type="submit" className="primary-button w-full" disabled={loading}>
            {loading ? "Verifying..." : mode === "signin" ? "Sign In to Workspace" : "Create Account"}
          </button>
        </form>

        <div className="auth-footer">
          <ShieldCheck size={13} />
          <span>Tenant isolation enforced with Row Level Security</span>
        </div>
    </Modal>
  );
}
