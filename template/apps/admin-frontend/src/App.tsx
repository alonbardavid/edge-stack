import { Routes, Route } from "react-router-dom";
import { AdminLoginScreen } from "./screens/login/AdminLoginScreen";
import { UsersScreen } from "./screens/users/UsersScreen";
import { AdminShell } from "./components/AdminShell";
import { UnauthenticatedLayout } from "./components/layouts/UnauthenticatedLayout";
import { LoadingLayout } from "./components/layouts/LoadingLayout";
import { useAdminMe } from "./logic/auth/useAdminMe";

export const App = () => {
  const { isLoggedIn, isInitializing } = useAdminMe();
  if (isInitializing) {
    return <LoadingLayout />;
  }

  if (!isLoggedIn) {
    return (
      <Routes>
        <Route element={<UnauthenticatedLayout />}>
          <Route path="*" element={<AdminLoginScreen />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route path="/" element={<UsersScreen />} />
        <Route path="*" element={<UsersScreen />} />
      </Route>
    </Routes>
  );
};
