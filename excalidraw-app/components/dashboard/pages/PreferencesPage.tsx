import { MonitorIcon, MoonIcon, SlidersIcon, SunIcon } from "../icons";
import { useDashboardTheme } from "../theme";
import { PageHeader, Card } from "../ui";

const THEMES = [
  { value: "light", label: "Light", icon: <SunIcon className="h-5 w-5" /> },
  { value: "dark", label: "Dark", icon: <MoonIcon className="h-5 w-5" /> },
  {
    value: "system",
    label: "System",
    icon: <MonitorIcon className="h-5 w-5" />,
  },
] as const;

export function PreferencesPage() {
  const { theme, setTheme } = useDashboardTheme();
  return (
    <>
      <PageHeader
        icon={<SlidersIcon className="h-6 w-6" />}
        title="Preferences"
        subtitle="Saved in this browser."
      />
      <div className="flex max-w-2xl flex-col gap-6">
        <Card
          title="Theme"
          description="Used by the dashboard and the editor. System follows your device setting."
        >
          <div
            role="radiogroup"
            aria-label="Theme"
            className="grid grid-cols-3 gap-3"
          >
            {THEMES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={theme === option.value}
                onClick={() => setTheme(option.value)}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border px-3 py-4 text-sm ${
                  theme === option.value
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
