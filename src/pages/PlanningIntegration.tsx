import { useEffect, useMemo, useState } from "react";
import { subscribeToDateTrack, subscribeToSchedule, subscribeToSpecPlan } from "@/lib/firebase";
import type { ScheduleItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AnyRecord = Record<string, any>;

type VehicleRow = {
  chassis: string;
  currentStatus: string;
  daysFromPurchaseOrder: number | null;
  purchaseOrderSent: string;
  chassisWelding: string;
  assemblyLine: string;
  finishGoods: string;
  leavingFactory: string;
  spec: string;
  plan: string;
  customer: string;
  dealer: string;
  model: string;
  forecastProductionDate: string;
};

const STAGE_ORDER: Array<keyof Pick<VehicleRow, "purchaseOrderSent" | "chassisWelding" | "assemblyLine" | "finishGoods" | "leavingFactory">> = [
  "purchaseOrderSent",
  "chassisWelding",
  "assemblyLine",
  "finishGoods",
  "leavingFactory",
];

const STATUS_MAP: Record<string, string> = {
  purchaseOrderSent: "Purchase Order Sent",
  chassisWelding: "Melbourne Factory · Chassis Welding",
  assemblyLine: "Melbourne Factory · Assembly Line",
  finishGoods: "Melbourne Factory · Finished Goods",
  leavingFactory: "Melbourne Factory · Leaving Factory",
};

const DATE_KEYS: Record<keyof Pick<VehicleRow, "chassisWelding" | "assemblyLine" | "finishGoods" | "leavingFactory">, string[]> = {
  chassisWelding: ["chassiswelding", "chassis_welding", "welding", "chassis welding"],
  assemblyLine: ["assemblyline", "assembly_line", "assembly", "assembly line"],
  finishGoods: ["finishgoods", "finish_goods", "finishedgoods", "finished goods"],
  leavingFactory: ["leavingfactory", "leaving_factory", "leftfactory", "dispatchedfromfactory", "dispatched from factory"],
};

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractValueByPossibleKeys(source: AnyRecord, possibleKeys: string[]): string {
  const entries = Object.entries(source || {});
  for (const [rawKey, rawValue] of entries) {
    const normalized = normalizeKey(rawKey);
    if (possibleKeys.some((key) => normalized === normalizeKey(key))) {
      return String(rawValue ?? "").trim();
    }
  }
  return "";
}

function parseDate(input: string): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  const isoParsed = new Date(trimmed);
  if (!Number.isNaN(isoParsed.getTime())) return isoParsed;

  const dmY = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const [, d, m, y] = dmY;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function computeCurrentStatus(row: VehicleRow): string {
  for (let i = STAGE_ORDER.length - 1; i >= 0; i -= 1) {
    const key = STAGE_ORDER[i];
    if (row[key]) {
      return STATUS_MAP[key];
    }
  }
  return "Not Started";
}

export default function PlanningIntegration() {
  const [orders, setOrders] = useState<ScheduleItem[]>([]);
  const [dateTrackMap, setDateTrackMap] = useState<Record<string, AnyRecord>>({});
  const [specPlanMap, setSpecPlanMap] = useState<Record<string, AnyRecord>>({});

  const [filters, setFilters] = useState<Record<string, string>>({
    chassis: "",
    currentStatus: "",
    customer: "",
    dealer: "",
    model: "",
    forecastProductionDate: "",
  });

  useEffect(() => {
    const unSubSchedule = subscribeToSchedule((data) => setOrders(data || []), {
      includeFinished: true,
      includeNoChassis: false,
      includeNoCustomer: true,
    });

    const unSubDateTrack = subscribeToDateTrack((data) => {
      const nextMap: Record<string, AnyRecord> = {};
      Object.entries(data || {}).forEach(([k, v]) => {
        nextMap[String(k)] = (v || {}) as AnyRecord;
      });
      setDateTrackMap(nextMap);
    });

    const unSubSpecPlan = subscribeToSpecPlan((data) => {
      const nextMap: Record<string, AnyRecord> = {};
      Object.entries(data || {}).forEach(([k, v]) => {
        nextMap[String(k)] = (v || {}) as AnyRecord;
      });
      setSpecPlanMap(nextMap);
    });

    return () => {
      unSubSchedule();
      unSubDateTrack();
      unSubSpecPlan();
    };
  }, []);

  const rows = useMemo<VehicleRow[]>(() => {
    return orders.map((order) => {
      const chassis = String(order.Chassis || "").trim();
      const track = dateTrackMap[chassis] || {};
      const specPlan = specPlanMap[chassis] || {};

      const purchaseOrderSent = String(order["Purchase Order Sent"] || "").trim();
      const chassisWelding = extractValueByPossibleKeys(track, DATE_KEYS.chassisWelding);
      const assemblyLine = extractValueByPossibleKeys(track, DATE_KEYS.assemblyLine);
      const finishGoods = extractValueByPossibleKeys(track, DATE_KEYS.finishGoods);
      const leavingFactory = extractValueByPossibleKeys(track, DATE_KEYS.leavingFactory);

      const purchaseOrderDate = parseDate(purchaseOrderSent);
      const daysFromPurchaseOrder = purchaseOrderDate
        ? Math.max(0, Math.floor((Date.now() - purchaseOrderDate.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      const row: VehicleRow = {
        chassis,
        currentStatus: "",
        daysFromPurchaseOrder,
        purchaseOrderSent,
        chassisWelding,
        assemblyLine,
        finishGoods,
        leavingFactory,
        spec: String(specPlan.spec || specPlan["Spec File"] || "").trim(),
        plan: String(specPlan.plan || specPlan["Plan File"] || "").trim(),
        customer: String(order.Customer || "").trim(),
        dealer: String(order.Dealer || "").trim(),
        model: String(order.Model || "").trim(),
        forecastProductionDate: String(order["Forecast Production Date"] || "").trim(),
      };

      row.currentStatus = computeCurrentStatus(row);
      return row;
    });
  }, [orders, dateTrackMap, specPlanMap]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      Object.entries(filters).every(([key, value]) => {
        if (!value.trim()) return true;
        const cell = String((row as AnyRecord)[key] ?? "").toLowerCase();
        return cell.includes(value.toLowerCase().trim());
      })
    );
  }, [rows, filters]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <Card>
        <CardHeader>
          <CardTitle>车辆情况搜索</CardTitle>
          <p className="text-sm text-slate-500">支持按列批量搜索，每台车会在下方表格中展示完整生产节点。</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Input placeholder="搜索车架号" value={filters.chassis} onChange={(e) => setFilters((p) => ({ ...p, chassis: e.target.value }))} />
            <Input placeholder="搜索当前状态" value={filters.currentStatus} onChange={(e) => setFilters((p) => ({ ...p, currentStatus: e.target.value }))} />
            <Input placeholder="搜索客户" value={filters.customer} onChange={(e) => setFilters((p) => ({ ...p, customer: e.target.value }))} />
            <Input placeholder="搜索经销商" value={filters.dealer} onChange={(e) => setFilters((p) => ({ ...p, dealer: e.target.value }))} />
            <Input placeholder="搜索车型" value={filters.model} onChange={(e) => setFilters((p) => ({ ...p, model: e.target.value }))} />
            <Input placeholder="搜索预测生产日期" value={filters.forecastProductionDate} onChange={(e) => setFilters((p) => ({ ...p, forecastProductionDate: e.target.value }))} />
          </div>

          <div className="rounded-md border bg-white overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>车架号</TableHead>
                  <TableHead>当前状态</TableHead>
                  <TableHead>天数 Purchase Order Sent</TableHead>
                  <TableHead>Purchase Order Sent</TableHead>
                  <TableHead>chassisWelding</TableHead>
                  <TableHead>assemblyLine</TableHead>
                  <TableHead>finishGoods</TableHead>
                  <TableHead>leavingFactory</TableHead>
                  <TableHead>Spec</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>经销商</TableHead>
                  <TableHead>车型</TableHead>
                  <TableHead>预测生产日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center text-slate-500 py-8">
                      暂无匹配车辆
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.chassis}>
                      <TableCell>{row.chassis || "-"}</TableCell>
                      <TableCell>{row.currentStatus}</TableCell>
                      <TableCell>{row.daysFromPurchaseOrder ?? "-"}</TableCell>
                      <TableCell>{row.purchaseOrderSent || "-"}</TableCell>
                      <TableCell>{row.chassisWelding || "-"}</TableCell>
                      <TableCell>{row.assemblyLine || "-"}</TableCell>
                      <TableCell>{row.finishGoods || "-"}</TableCell>
                      <TableCell>{row.leavingFactory || "-"}</TableCell>
                      <TableCell>{row.spec || "-"}</TableCell>
                      <TableCell>{row.plan || "-"}</TableCell>
                      <TableCell>{row.customer || "-"}</TableCell>
                      <TableCell>{row.dealer || "-"}</TableCell>
                      <TableCell>{row.model || "-"}</TableCell>
                      <TableCell>{row.forecastProductionDate || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
