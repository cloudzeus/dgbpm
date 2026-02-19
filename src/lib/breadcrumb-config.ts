export function getBreadcrumbFromPath(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Dashboard", href: "/dashboard" }];

  const routeLabels: Record<string, string> = {
    dashboard: "Dashboard",
    users: "Users",
    departments: "Departments",
    positions: "Job Positions",
    "process-templates": "Process Templates",
    "process-instances": "Process Instances",
    "my-tasks": "My Tasks",
    "my-processes": "My Processes",
    auth: "Auth",
    login: "Sign in",
    register: "Register",
    "forgot-password": "Forgot password",
  };

  const result: { label: string; href?: string }[] = [];
  let href = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    href += `/${seg}`;
    const label =
      routeLabels[seg] ?? (seg.length > 15 ? "Detail" : seg.charAt(0).toUpperCase() + seg.slice(1));
    result.push({
      label,
      href: i < segments.length - 1 ? href : undefined,
    });
  }

  return result;
}
