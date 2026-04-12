import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName || undefined);
      }
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "calc(100vh - 80px)",
        padding: 32,
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 400 }}>
        <h2
          className="section-title"
          style={{ textAlign: "center", marginBottom: 24 }}
        >
          {isLogin ? "Sign In" : "Create Account"}
        </h2>

        {error && (
          <p
            style={{
              color: "var(--red)",
              fontSize: 13,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          {!isLogin && (
            <div>
              <label
                className="text-dim text-sm"
                style={{ display: "block", marginBottom: 6 }}
              >
                Display Name
              </label>
              <input
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label
              className="text-dim text-sm"
              style={{ display: "block", marginBottom: 6 }}
            >
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              className="text-dim text-sm"
              style={{ display: "block", marginBottom: 6 }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          >
            {loading ? (
              <span className="spinner" />
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p
          className="text-dim text-sm"
          style={{ textAlign: "center", marginTop: 20 }}
        >
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span
            style={{
              color: "var(--accent)",
              cursor: "pointer",
              fontWeight: 500,
            }}
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
          >
            {isLogin ? "Register" : "Login"}
          </span>
        </p>
      </div>
    </div>
  );
}
