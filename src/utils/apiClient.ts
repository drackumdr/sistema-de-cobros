export interface LoginResponse {
  jwt: string;
  tenantApiKey: string;
  name: string;
  role: string;
  userId: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

export class ApiClient {
  static getBaseUrl(): string {
    return "https://b9srulj4f8.execute-api.us-east-1.amazonaws.com/prod";
  }

  /**
   * Performs authentication POSTing { tenantId, username, password }
   */
  static async login(tenantId: string, username: string, password: string): Promise<LoginResponse> {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tenantId, username, password })
    });
    
    if (!res.ok) {
      let errMsg = "Credenciales incorrectas o error en el servidor";
      try {
        const text = await res.text();
        if (text) {
          try {
            const parsed = JSON.parse(text);
            errMsg = parsed.message || parsed.error || errMsg;
          } catch {
            errMsg = text;
          }
        }
      } catch (e) {
        // quiet
      }
      throw new Error(errMsg);
    }
    
    return await res.json() as LoginResponse;
  }

  /**
   * Generates authorization and AWS credentials proxy headers for our local node express API
   */
  static getAuthHeaders(): Record<string, string> {
    const jwt = localStorage.getItem("detektor_jwt") || "";
    const tenantId = localStorage.getItem("detektor_tenant_id") || "";
    const accessKeyId = localStorage.getItem("detektor_aws_access_key_id") || "";
    const secretAccessKey = localStorage.getItem("detektor_aws_secret_access_key") || "";
    const sessionToken = localStorage.getItem("detektor_aws_session_token") || "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }
    if (tenantId) {
      headers["X-Tenant-Id"] = tenantId;
    }
    if (accessKeyId) {
      headers["X-AWS-Access-Key-Id"] = accessKeyId;
    }
    if (secretAccessKey) {
      headers["X-AWS-Secret-Access-Key"] = secretAccessKey;
    }
    if (sessionToken) {
      headers["X-AWS-Session-Token"] = sessionToken;
    }

    return headers;
  }

  /**
   * Safely clears all company and AWS session storage properties from browser
   */
  static logout() {
    localStorage.removeItem("detektor_jwt");
    localStorage.removeItem("detektor_tenant_api_key");
    localStorage.removeItem("detektor_name");
    localStorage.removeItem("detektor_role");
    localStorage.removeItem("detektor_user_id");
    localStorage.removeItem("detektor_aws_access_key_id");
    localStorage.removeItem("detektor_aws_secret_access_key");
    localStorage.removeItem("detektor_aws_session_token");
    localStorage.removeItem("detektor_tenant_id");
  }

  /**
   * Helper that checks if token is set
   */
  static isAuthenticated(): boolean {
    return !!localStorage.getItem("detektor_jwt");
  }

  /**
   * Read raw tenant metadata for display
   */
  static getSessionMetadata() {
    return {
      name: localStorage.getItem("detektor_name") || "Usuario",
      role: localStorage.getItem("detektor_role") || "Operador",
      tenantId: localStorage.getItem("detektor_tenant_id") || "",
      userId: localStorage.getItem("detektor_user_id") || ""
    };
  }
}
