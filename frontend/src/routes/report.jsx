import { useLocation, Navigate } from "react-router-dom"
import OperationalReport from "../reports/OperationalReport"
import { buildOperationalReportData } from "../reports/buildOperationalReportData"

export default function ReportRoute() {
  const { state } = useLocation()

  if (!state?.dashboardData) {
    return <Navigate to="/dashboard" replace />
  }

  const report = buildOperationalReportData({
    dados: state.dashboardData, // ✅ AQUI
    turno: state.turno,
    periodo: state.periodo,
  })

  return <OperationalReport report={report} />
}
