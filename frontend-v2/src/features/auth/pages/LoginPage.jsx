export default function LoginPage() {
  function login() {
    localStorage.setItem("auth", "true");
    window.location.href = "/chat";
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#F8FAFC",
      }}
    >
      <div
        style={{
          width: 380,
          background: "#fff",
          padding: 40,
          borderRadius: 20,
          boxShadow: "0 10px 30px rgba(0,0,0,.08)",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            marginBottom: 10,
            color: "#2563EB",
          }}
        >
          AssamWork AI
        </h1>

        <p
          style={{
            color: "#64748B",
            marginBottom: 30,
          }}
        >
          AI Tutor for Assam Students
        </p>

        <button
          onClick={login}
          style={{
            width: "100%",
            padding: 14,
            border: "none",
            borderRadius: 12,
            background: "#2563EB",
            color: "#fff",
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}