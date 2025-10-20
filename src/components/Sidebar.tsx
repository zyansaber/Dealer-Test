import { useMemo } from "react";
import { Package, BarChart3, Factory, FileX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavLink, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ScheduleItem } from "@/types";

interface SidebarProps {
  orders: ScheduleItem[];
  selectedDealer: string;
  onDealerSelect: (dealer: string) => void;
  hideOtherDealers?: boolean;
  currentDealerName?: string;
  showStats?: boolean;
}

/** ---- 安全工具函数：统一兜底，避免 undefined.toLowerCase 报错 ---- */
const toStr = (v: any) => String(v ?? "");
const lower = (v: any) => toStr(v).toLowerCase();

export default function Sidebar({
  orders,
  selectedDealer,
  onDealerSelect,
  hideOtherDealers = false,
  currentDealerName,
  showStats = true
}: SidebarProps) {
  const { dealerSlug } = useParams<{ dealerSlug: string }>();

  // 计算基础统计数据（仅保留总订单数/stock/customer）
  const stats = useMemo(() => {
    const total = Array.isArray(orders) ? orders.length : 0;

    const stockVehicles = (Array.isArray(orders) ? orders : []).filter(
      (order) => lower(order?.Customer).endsWith("stock")
    ).length;

    const customerVehicles = Math.max(total - stockVehicles, 0);

    return { total, stockVehicles, customerVehicles };
  }, [orders]);

  // 获取显示的dealer名称
  const displayDealerName = useMemo(() => {
    if (hideOtherDealers && currentDealerName) {
      return currentDealerName;
    }
    if (selectedDealer === "all") {
      return "All Dealers";
    }
    return selectedDealer || "Dealer Portal";
  }, [selectedDealer, hideOtherDealers, currentDealerName]);

  // 导航路径
  const basePath = dealerSlug ? `/dealer/${dealerSlug}` : "/";
  const navigationItems = [
    { path: basePath, label: "Dealer Orders", icon: BarChart3, end: true },
    { path: `${basePath}/inventorystock`, label: "Factory Inventory", icon: Factory, end: true },
    { path: `${basePath}/unsigned`, label: "Unsigned & Empty Slots", icon: FileX, end: true },
    { path: `${basePath}/dashboard`, label: "Dashboard", icon: Package, end: true }
  ];

  return (
    <aside className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {hideOtherDealers ? displayDealerName : "Dealer Portal"}
            </h1>
            <p className="text-sm text-slate-500">Order Management System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      {dealerSlug && (
        <div className="p-4 border-b border-slate-200">
          <nav className="space-y-1">
            {navigationItems.map((item) => (
              <NavLink key={item.path} to={item.path} end={item.end}>
                {({ isActive }) => (
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className="w-full justify-start"
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    {item.label}
                  </Button>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      {/* Current Context Display - 在隐藏模式下显示当前dealer */}
      {hideOtherDealers && (
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Current Dealer</h3>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="font-medium text-blue-900">{displayDealerName}</div>
            <div className="text-sm text-blue-700">Dealer Portal</div>
          </div>
        </div>
      )}

      {/* Basic Stats - 只显示基础统计 */}
      {showStats && (
        <div className="p-4 space-y-4">
          <h3 className="text-sm font-medium text-slate-700">
            {displayDealerName} Overview
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-slate-600 flex items-center">
                  <Package className="w-3 h-3 mr-1" />
                  Total Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </aside>
  );
}
