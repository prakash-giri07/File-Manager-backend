import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// ================= ENV =================
const GRAPH_API_VERSION = process.env.FB_API_VERSION || "v24.0";

let PAGE_ACCESS_TOKEN = process.env.INITIAL_PAGE_TOKEN || null;
let USER_ACCESS_TOKEN = process.env.USER_ACCESS_TOKEN;
let TOKEN_EXPIRY = null;

const APP_ID = process.env.FB_APP_ID;
const APP_SECRET = process.env.FB_APP_SECRET;
const AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;

console.log(APP_ID);

// ================= TOKEN SYSTEM =================
function isTokenExpired() {
  if (!TOKEN_EXPIRY) return true;
  return Date.now() >= TOKEN_EXPIRY;
}

async function refreshPageAccessToken() {
  try {
    const longUserResponse = await axios.get(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`,
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: APP_ID,
          client_secret: APP_SECRET,
          fb_exchange_token: USER_ACCESS_TOKEN,
        },
      },
    );

    const longUserToken = longUserResponse.data.access_token;

    const pageResponse = await axios.get(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts`,
      {
        params: { access_token: longUserToken },
      },
    );

    const pages = pageResponse.data.data;

    if (!pages || pages.length === 0) {
      throw new Error("No Facebook pages found");
    }

    PAGE_ACCESS_TOKEN = pages[0].access_token;

    TOKEN_EXPIRY = Date.now() + 50 * 24 * 60 * 60 * 1000;
    console.log(PAGE_ACCESS_TOKEN);
  } catch (error) {
    console.error(
      "Token refresh failed:",
      error.response?.data || error.message,
    );
    throw new Error("Token refresh failed");
  }
}

async function withValidToken(fn) {
  try {
    if (!PAGE_ACCESS_TOKEN || isTokenExpired()) {
      await refreshPageAccessToken();
    }
    return await fn(PAGE_ACCESS_TOKEN);
  } catch (error) {
    console.error("Token wrapper error:", error.message);
    throw error;
  }
}

// ================= FETCH CAMPAIGNS =================
async function fetchCampaignInsights(startDate, endDate) {
  return withValidToken(async (token) => {
    if (!AD_ACCOUNT_ID) {
      throw new Error("Missing FB_AD_ACCOUNT_ID");
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/act_${AD_ACCOUNT_ID}/insights`;

    const params = {
      access_token: token,
      fields: "campaign_name,spend,clicks,ctr,cpc,date_start",
    };

    if (startDate && endDate) {
      params.time_range = {
        since: startDate,
        until: endDate,
      };
    } else {
      params.date_preset = "last_7d";
    }

    const response = await axios.get(url, { params });

    return (response.data.data || []).map((item, index) => ({
      id: index + 1,
      campaign: item.campaign_name,
      spend: Number(item.spend || 0),
      clicks: Number(item.clicks || 0),
      ctr: Number(item.ctr || 0),
      cpc: Number(item.cpc || 0),
      date: item.date_start,
    }));
  });
}

// ================= API: CAMPAIGNS =================
export const getCampaigns = async (req, res) => {
  try {
    const { campaign, startDate, endDate } = req.query;

    let campaigns = await fetchCampaignInsights(startDate, endDate);

    if (campaign) {
      campaigns = campaigns.filter((c) => c.campaign === campaign);
    }

    res.json(campaigns);
  } catch (error) {
    console.error("Campaign error:", error.message);
    res.status(500).json({
      message: "Error fetching campaigns",
    });
  }
};

// ================= API: KPI =================
export const getKPI = async (req, res) => {
  try {
    const { campaign, startDate, endDate } = req.query;

    let campaigns = await fetchCampaignInsights(startDate, endDate);

    if (campaign) {
      campaigns = campaigns.filter((c) => c.campaign === campaign);
    }

    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);

    const avgCTR =
      campaigns.length > 0
        ? campaigns.reduce((sum, c) => sum + c.ctr, 0) / campaigns.length
        : 0;

    const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;

    res.json({
      spend: Math.round(totalSpend),
      clicks: totalClicks,
      ctr: Number(avgCTR.toFixed(2)),
      cpc: Number(avgCPC.toFixed(2)),
    });
  } catch (error) {
    console.error("KPI error:", error.message);
    res.status(500).json({
      message: "Error fetching KPI",
    });
  }
};
