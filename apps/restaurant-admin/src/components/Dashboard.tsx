import { useEffect, useState } from 'react';
import type { RestaurantDashboardResponse } from '@tablediner/shared-types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function Dashboard({ restaurantId }: { restaurantId: string }) {
  const [metrics, setMetrics] = useState<RestaurantDashboardResponse | null>(null);
  const [eodReport, setEodReport] = useState<any>(null); // We can just use 'any' or import RestaurantEodReportResponse
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchMetrics(date);
  }, [restaurantId, date]);

  const fetchMetrics = async (targetDate: string) => {
    setLoading(true);
    try {
      const [metricsRes, eodRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/restaurants/${restaurantId}/metrics/daily?date=${targetDate}`),
        fetch(`${API_URL}/api/v1/restaurants/${restaurantId}/audit/eod?date=${targetDate}`)
      ]);
      
      if (!metricsRes.ok) throw new Error('Failed to fetch metrics');
      if (!eodRes.ok) throw new Error('Failed to fetch EOD report');
      
      const metricsData = await metricsRes.json();
      const eodData = await eodRes.json();
      
      setMetrics(metricsData);
      setEodReport(eodData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-zinc-500 animate-pulse p-8">Loading Analytics...</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded-xl">{error}</div>;
  if (!metrics) return null;

  const { financials, orders, utilization, slas } = metrics;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-zinc-900">End of Day Analytics</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-zinc-600">Business Date:</label>
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm"
          />
        </div>
      </div>

      {/* Financials Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Net Revenue" value={`₹${financials.netRevenue.toFixed(2)}`} />
        <MetricCard title="Gross Revenue" value={`₹${financials.grossRevenue.toFixed(2)}`} />
        <MetricCard title="Avg Ticket Size" value={`₹${financials.avgTicketSize.toFixed(2)}`} />
        <MetricCard title="Tips Collected" value={`₹${financials.totalTips.toFixed(2)}`} />
      </div>

      {/* Utilization & Orders Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Orders" value={orders.totalOrders.toString()} />
        <MetricCard title="Covers Served (Pax)" value={utilization.coversServed.toString()} />
        <MetricCard title="Spend Per Head" value={`₹${utilization.revenuePerCover.toFixed(2)}`} />
        <MetricCard title="Cancellation Rate" value={`${(orders.cancellationRate * 100).toFixed(1)}%`} highlight={orders.cancellationRate > 0.1 ? 'red' : 'green'} />
      </div>

      {/* SLA Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Avg Table Turn Time" value={`${Math.round(utilization.avgTableTurnTimeMinutes)} min`} />
        <MetricCard title="Avg Kitchen Prep Time" value={`${Math.round(slas.avgKitchenPrepTimeMinutes)} min`} />
        <MetricCard title="Avg Order Fulfillment" value={`${Math.round(slas.avgFulfillmentTimeMinutes)} min`} />
      </div>

      <div className="p-6 bg-blue-50 text-blue-800 rounded-2xl text-sm leading-relaxed border border-blue-100 print:hidden">
        <strong>Note on Analytics:</strong> Metrics shown are calculated against the logical "Business Date". 
        Sessions crossing midnight are assigned to the date of their creation if they fall before the configured cutoff hour.
      </div>

      {/* EOD Audit Report */}
      {eodReport && (
        <div className="mt-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-zinc-900">EOD Session Audit</h2>
            <div className="flex gap-2 print:hidden">
              <a 
                href={`${API_URL}/api/v1/restaurants/${restaurantId}/audit/eod/export?date=${date}`}
                download
                className="px-4 py-2 bg-forest-900 hover:bg-forest-800 text-white rounded-lg font-bold text-sm shadow-sm"
              >
                Export CSV
              </a>
              <button 
                onClick={() => window.print()} 
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg font-bold text-sm shadow-sm"
              >
                Print Report
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto bg-white rounded-xl border border-zinc-200 shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold">
                <tr>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3">Pax</th>
                  <th className="px-4 py-3">Net (₹)</th>
                  <th className="px-4 py-3">Tax (₹)</th>
                  <th className="px-4 py-3">Tip (₹)</th>
                  <th className="px-4 py-3">Total (₹)</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {eodReport.sessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">No sessions recorded for this date.</td>
                  </tr>
                ) : (
                  eodReport.sessions.map((session: any) => (
                    <tr key={session.sessionId} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-forest-900">{session.tableName}</td>
                      <td className="px-4 py-3">{session.guestCount}</td>
                      <td className="px-4 py-3">{session.netAmount.toFixed(2)}</td>
                      <td className="px-4 py-3">{session.taxAmount.toFixed(2)}</td>
                      <td className="px-4 py-3">{session.tipAmount.toFixed(2)}</td>
                      <td className="px-4 py-3 font-bold">{session.grossAmount.toFixed(2)}</td>
                      <td className="px-4 py-3">{session.paymentMethods.join(', ') || '-'}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{new Date(session.closedAt).toLocaleTimeString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                          session.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700'
                        }`}>
                          {session.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, highlight }: { title: string, value: string, highlight?: 'red' | 'green' }) {
  let valueColor = "text-zinc-900";
  if (highlight === 'red') valueColor = "text-red-600";
  if (highlight === 'green') valueColor = "text-emerald-600";

  return (
    <div className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm flex flex-col justify-center">
      <h3 className="text-sm font-medium text-zinc-500 mb-1">{title}</h3>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

