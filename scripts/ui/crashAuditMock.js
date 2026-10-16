import { supabase as base, SUPABASE_URL } from "./apnUXMock.js";
export { SUPABASE_URL };
const fault = new URLSearchParams(location.search).get("fault") === "malformed";
export const supabase = {
  ...base,
  async rpc(name, args) {
    if (name === "client_ai_status") return { data: true, error: null };
    if (fault && name === "ai_get_dashboard") return { data: {
      health: "corrupt", lead_scores: {}, partner_scores: "bad", employee_scores: false,
      forecasts: { data: [] }, insights: "bad", recommendations: { items: [] }, settings: []
    }, error: null };
    if (fault && name === "app_error_health") return {data:{groups:{unexpected:true}}, error:null};
    if (fault && name === "ai_memory_admin_explorer") return {data:{records:[]}, error:null};
    if (fault && name === "ai_intelligence_v5_dashboard") return {data:{lead_predictions:{},partner_predictions:"bad",recommendations:{}},error:null};
    if (fault && name === "business_automation_history") return {data:{},error:null};
    return base.rpc(name,args);
  }
};
