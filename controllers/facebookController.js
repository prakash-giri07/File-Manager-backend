import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// ================= ENV =================
const GRAPH_API_VERSION = process.env.FB_API_VERSION || "v24.0";
const USER_ACCESS_TOKEN = process.env.USER_ACCESS_TOKEN;

// ================= CONFIG =================
const REQUEST_DELAY = 400; // safer delay
const MAX_RETRIES = 3;

// ================= HELPERS =================
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

//  Retry wrapper (handles rate limit + network issues)
async function safeApiCall(fn, retries = MAX_RETRIES) {
  try {
    return await fn();
  } catch (error) {
    const code = error.response?.data?.error?.code;

    if ((code === 80004 || !code) && retries > 0) {
      console.log("⚠️ Retrying API call...");
      await sleep(1000);
      return safeApiCall(fn, retries - 1);
    }

    throw error;
  }
}

// ================= PAGINATION =================
async function fetchAllPages(url, params) {
  let allData = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = await safeApiCall(() =>
      axios.get(nextUrl, {
        params: nextUrl === url ? params : {},
      }),
    );

    const data = response.data?.data || [];
    allData = [...allData, ...data];

    nextUrl = response.data?.paging?.next || null;

    if (nextUrl) await sleep(REQUEST_DELAY);
  }

  return allData;
}

// ================= GET CAMPAIGNS =================
const getCampaigns = async (accountId) => {
  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}/campaigns`;

    const params = {
      access_token: USER_ACCESS_TOKEN,
      fields: "id,name,status,daily_budget,lifetime_budget",
    };

    const data = await fetchAllPages(url, params);

    return { success: true, data };
  } catch (error) {
    console.error("Campaign error:", error.response?.data || error.message);
    return { success: false, data: [] };
  }
};

// ================= GET CAMPAIGN INSIGHTS =================
const getCampaignInsights = async (accountId, filters = {}) => {
  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}/insights`;

    const params = {
      access_token: USER_ACCESS_TOKEN,
      level: "campaign",

      fields: `
        campaign_id,
        campaign_name,
        date_start,
        date_stop,
        impressions,
        clicks,
        spend,
        reach,
        ctr,
        cpc,
        actions
      `,

      time_increment: 1,
    };

    if (filters.since && filters.until) {
      params.time_range = {
        since: filters.since,
        until: filters.until,
      };
    } else {
      params.date_preset = "last_30d";
    }

    const data = await fetchAllPages(url, params);

    return { success: true, data };
  } catch (error) {
    console.error("Insights error:", error.response?.data || error.message);
    return { success: false, data: [] };
  }
};

// ================= DEFAULT INSIGHTS =================
const getDefaultInsights = () => ({
  impressions: "0",
  clicks: "0",
  spend: "0",
  reach: "0",
  ctr: "0",
  cpc: "0",
});

// ================= MERGE FUNCTION =================
const mergeCampaignsWithInsights = (campaigns, insights) => {
  const insightMap = {};

  for (const ins of insights) {
    if (!ins.campaign_id) continue;

    // create array for each campaign
    if (!insightMap[ins.campaign_id]) {
      insightMap[ins.campaign_id] = [];
    }

    // push daily data instead of overwrite
    insightMap[ins.campaign_id].push(ins);
  }

  return campaigns.map((camp) => ({
    ...camp,
    insights: insightMap[camp.id] || [],
  }));
};

// ================= MAIN API =================
export const getAdAccounts = async (req, res) => {
  try {
    if (!USER_ACCESS_TOKEN) {
      throw new Error("Missing USER_ACCESS_TOKEN");
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/adaccounts`;

    const params = {
      access_token: USER_ACCESS_TOKEN,
      fields: "id,name,account_status,currency,timezone_name",
    };

    const accounts = await fetchAllPages(url, params);

    const finalData = [];

    for (const account of accounts) {
      console.log(`Processing account: ${account.id}`);

      // 🔹 Campaigns
      const campaignRes = await getCampaigns(account.id);
      const campaigns = Array.isArray(campaignRes.data) ? campaignRes.data : [];

      await sleep(REQUEST_DELAY);

      // 🔹 Insights (bulk)
      const insightsRes = await getCampaignInsights(account.id, req.body);
      const insights = Array.isArray(insightsRes.data) ? insightsRes.data : [];

      console.log(
        `Campaigns: ${campaigns.length}, Insights: ${insights.length}`,
      );

      // 🔹 Merge
      const mergedCampaigns = mergeCampaignsWithInsights(campaigns, insights);

      finalData.push({
        ...account,
        campaigns: mergedCampaigns,
      });

      await sleep(REQUEST_DELAY);
    }

    res.json({
      success: true,
      total_accounts: finalData.length,
      data: finalData,
    });
  } catch (error) {
    console.error("Main error:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message: "Error fetching ad accounts",
      error: error.response?.data || error.message,
    });
  }
};
