import { useAuth } from '../contexts/AuthContext'; // 👈 AuthContext 훅 import

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div style={{ padding: 16 }}>
      <h2>Dashboard</h2>
      {isAuthenticated ? (
        <p>Welcome, {user.username}! You are logged in.</p>
      ) : (
        <p>You are not logged in. Please login.</p>
      )}
    </div>
  );
}