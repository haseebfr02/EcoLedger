import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useAuth0 } from "@auth0/auth0-react";
import { API_BASE_URL } from "@/lib/apiConfig";

interface MonthlyItem {
  month: string;
  offsets: number;
  retired: number;
}

interface ProjectTypeItem {
  type: string;
  offsets: number;
  retired: number;
}

interface ChartsProps {
  monthlyData?: { month: string; offsets: number }[];
}

const CATEGORIES = ["Energy", "Agriculture", "Other", "Waste", "Forestation"];

export const Charts: React.FC<ChartsProps> = () => {
  const [projectTypeData, setProjectTypeData] = useState<ProjectTypeItem[]>(
    CATEGORIES.map((type) => ({ type, offsets: 0, retired: 0 }))
  );
  const [monthlyData, setMonthlyData] = useState<MonthlyItem[]>([]);
  const { user } = useAuth0();

  const toNumber = (value: any) => {
    const parsed = Number(String(value ?? 0).replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  useEffect(() => {
    const fetchProjectTypeData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/projects/status-summary`);
        const result = await response.json();

        const incoming = Array.isArray(result.statusSummary)
          ? result.statusSummary
          : [];

        const byType = new Map<string, ProjectTypeItem>();

        CATEGORIES.forEach((type) => {
          byType.set(type, { type, offsets: 0, retired: 0 });
        });

        incoming.forEach((item: any) => {
          const rawType = String(item.sector ?? "Other").trim().toLowerCase();

          const type =
            rawType === "energy"
              ? "Energy"
              : rawType === "agriculture"
              ? "Agriculture"
              : rawType === "waste"
              ? "Waste"
              : rawType === "forestation"
              ? "Forestation"
              : "Other";

          const current = byType.get(type)!;
          current.offsets += toNumber(item.totalAvailableUnits);
          current.retired += toNumber(item.totalRetiredUnits);
        });

        setProjectTypeData(
          CATEGORIES.map((type) => byType.get(type)!).map((item) => ({
            ...item,
            offsets: Number(item.offsets.toFixed(2)),
            retired: Number(item.retired.toFixed(2)),
          }))
        );
      } catch (error) {
        console.error("Error fetching project type data:", error);
      }
    };

    fetchProjectTypeData();
    const interval = window.setInterval(fetchProjectTypeData, 15000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user?.email) {
      setMonthlyData([]);
      return;
    }

    const fetchMonthlyData = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/projects/line-chart?email=${encodeURIComponent(
            user.email
          )}`
        );
        const result = await response.json();
        const summary = Array.isArray(result.lineSummary)
          ? result.lineSummary
          : [];

        const monthly = summary
          .map((item: any) => {
            const year = Number(item?._id?.year);
            const monthNumber = Number(item?._id?.month);
            const retired = toNumber(item?.totalQuantity);

            if (!year || !monthNumber) return null;

            const date = new Date(year, monthNumber - 1, 1);
            return {
              sortKey: date.getTime(),
              month: date.toLocaleString("default", {
                month: "short",
              }),
              retired,
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => a.sortKey - b.sortKey);

        let cumulative = 0;
        const formatted: MonthlyItem[] = monthly.map((item: any) => {
          cumulative += item.retired;
          return {
            month: item.month,
            offsets: Number(cumulative.toFixed(2)),
            retired: Number(item.retired.toFixed(2)),
          };
        });

        setMonthlyData(formatted);
      } catch (error) {
        console.error("Error fetching monthly retirement data:", error);
        setMonthlyData([]);
      }
    };

    fetchMonthlyData();
    const interval = window.setInterval(fetchMonthlyData, 15000);

    return () => window.clearInterval(interval);
  }, [user?.email]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Monthly Line Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#666" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#666" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: number, name: string) => {
                    const label =
                      name === "offsets"
                        ? "Cumulative CO₂e Offset"
                        : "Credits Retired This Month";
                    return [`${toNumber(value).toLocaleString()} tCO₂e`, label];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="offsets"
                  stroke="#22C55E"
                  strokeWidth={3}
                  dot={{ fill: "#22C55E", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: "#22C55E", strokeWidth: 2 }}
                  name="CO₂e Offset"
                />
                <Line
                  type="monotone"
                  dataKey="retired"
                  stroke="#EF4444"
                  strokeWidth={3}
                  dot={{ fill: "#EF4444", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: "#EF4444", strokeWidth: 2 }}
                  name="Retired"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Project Type Bar Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectTypeData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="type"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#666" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#666" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: number, name: string) => {
                    const label =
                      name === "Available Credits"
                        ? "Available Credits"
                        : "Retired Credits";
                    return [
                      `${toNumber(value).toLocaleString()} tCO₂e`,
                      label,
                    ];
                  }}
                />
                <Bar
                  dataKey="offsets"
                  name="Available Credits"
                  fill="#22C55E"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="retired"
                  name="Retired Credits"
                  fill="#EF4444"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Charts;
