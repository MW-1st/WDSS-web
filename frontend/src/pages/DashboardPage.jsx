export default function DashboardPage() {
  const token = localStorage.getItem("token");

  return (
    <div style={{ padding: 16 }}>
      <h2>Dashboard</h2>
      {token ? (
        <p>Logged in. Token stored in localStorage.</p>
      ) : (
        <p>No token found. Please login.</p>
      )}
    </div>
  );
}

