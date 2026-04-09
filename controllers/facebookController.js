import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// ================= ENV =================
const GRAPH_API_VERSION = process.env.FB_API_VERSION || "v24.0";
const USER_ACCESS_TOKEN = process.env.USER_ACCESS_TOKEN;

// ================= HELPER: PAGINATION =================
async function fetchAllPages(url, params) {
  let allData = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = await axios.get(nextUrl, {
      params: nextUrl === url ? params : {},
    });

    allData = [...allData, ...response.data.data];
    nextUrl = response.data.paging?.next || null;
  }

  return allData;
}

const getCampaigns = async (id) => {
  try {
    if (!USER_ACCESS_TOKEN) {
      throw new Error("Missing USER_ACCESS_TOKEN");
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${id}/campaigns`;

    const params = {
      access_token: USER_ACCESS_TOKEN,
      fields: "id,name,status,lifetime_budget,daily_budget",
      limit: 100,
    };

    const accounts = await fetchAllPages(url, params);

    return {
      success: true,
      total: accounts.length,
      data: accounts,
    };
  } catch (error) {
    console.error(
      "E2 Ad Accounts error:",
      error.response?.data || error.message,
    );

    return {
      success: false,
      message: "Error fetching ad accounts",
      error: error.response?.data || error.message,
    };
  }
};

const getBudget = async (id) => {
  try {
    if (!USER_ACCESS_TOKEN) {
      throw new Error("Missing USER_ACCESS_TOKEN");
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

    const accounts = await axios.get(
      `${url}/${id}?fields=insights%2Cname&access_token=${USER_ACCESS_TOKEN}`,
    );

    return accounts.data;
  } catch (error) {
    console.error(
      "E3 Ad Accounts error:",
      error.response?.data || error.message,
    );

    return {
      success: false,
      message: "Error fetching ad accounts",
      error: error.response?.data || error.message,
    };
  }
};

// ================= API: GET AD ACCOUNTS =================
export const getAdAccounts = async (req, res) => {
  try {
    if (!USER_ACCESS_TOKEN) {
      throw new Error("Missing USER_ACCESS_TOKEN");
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/adaccounts`;

    const params = {
      access_token: USER_ACCESS_TOKEN,
      fields: "id,name,account_status,currency,timezone_name",
      limit: 100,
    };

    const accounts = await fetchAllPages(url, params);

    let finalTurnover = [];

    await Promise.all(
      accounts.map(async (current_add_account, key) => {
        let getAllCampaign = await getCampaigns(current_add_account.id);
        let campaigns = getAllCampaign.data;
        let AllCampaignBudgets = [];
        await Promise.all(
          campaigns.map(async (current_campaign, key) => {
            let getBudgetofCampaign = await getBudget(current_campaign.id);
            AllCampaignBudgets.push(getBudgetofCampaign);
          }),
        );
        let myAddAccountData = current_add_account;
        myAddAccountData["campaigns"] = AllCampaignBudgets;
        return finalTurnover.push(myAddAccountData);
      }),
    );

    res.json(finalTurnover);
  } catch (error) {
    console.error(
      " E1 Ad Accounts error:",
      error.response?.data || error.message,
    );

    res.status(500).json({
      success: false,
      message: "Error fetching ad accounts",
      error: error.response?.data || error.message,
    });
  }
};
