import { Outlet } from "react-router-dom";

export const UnauthenticatedLayout = () => {
  return (
    <main
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <Outlet />
    </main>
  );
};
