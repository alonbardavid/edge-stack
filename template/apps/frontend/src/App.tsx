import { Routes, Route, Navigate } from "react-router-dom";
import { LoginScreen } from "./screens/login/LoginScreen";
import { HomeScreen } from "./screens/home/HomeScreen";
import { UnauthenticatedLayout } from "./components/layouts/UnauthenticatedLayout";
import { LoadingLayout } from "./components/layouts/LoadingLayout";
import { useMe } from "./logic/authentication/useMe";

export const App = () => {
  const { isLoggedIn, isInitializing } = useMe();
  if (isInitializing) {
    return <LoadingLayout />;
  }

  if (!isLoggedIn) {
    return (
      <Routes>
        <Route element={<UnauthenticatedLayout />}>
          <Route path="*" element={<LoginScreen />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
