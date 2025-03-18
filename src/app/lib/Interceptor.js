import axios from "axios";
import store from "../Store";
import { getSession } from "../features/Slice";
import { logoutUserAPI, refershBoth } from "@/src/Components/Api";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

const apiClient = axios.create({
    baseURL: baseUrl,
    withCredentials: true, // Ensure cookies are sent
});

// Track ongoing refresh requests
let isRefreshing = false;
let refreshSubscribers = [];

const addSubscriber = (callback) => {
    refreshSubscribers.push(callback);
};

const onRefreshed = (token) => {
    refreshSubscribers.forEach((callback) => {
        if (token) {
            callback(token);
        } else {
            callback(null); // Reject queued requests if refresh fails
        }
    });
    refreshSubscribers = [];
};

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response && error.response.status === 401) {
            const errorMessage = error.response.data.message;
            console.log("Interceptor Caught 401:", errorMessage);

            // ✅ Handle refresh scenario
            if (errorMessage === "Refersh") {
                console.log("🔄 Refresh token flow triggered...");
                
                if (!isRefreshing) {
                    isRefreshing = true;

                    try {
                        const refreshResponse = await refershBoth(); // Call refresh API
                        console.log("🔑 Refresh Response:", refreshResponse?.data);

                        if (refreshResponse?.data?.access) {
                            isRefreshing = false;
                            const newToken = refreshResponse.data.access;

                            // ✅ Retry all queued requests with the new token
                            onRefreshed(newToken);

                            // ✅ Retry the failed request
                            originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
                            originalRequest.withCredentials = true;
                            return apiClient(originalRequest);
                        }
                    } catch (refreshError) {
                        console.error("❌ Token refresh failed:", refreshError);
                    }

                    isRefreshing = false;
                }

                // ✅ Queue the failed request while waiting for refresh
                return new Promise((resolve) => {
                    addSubscriber((token) => {
                        if (token) {
                            originalRequest.headers["Authorization"] = `Bearer ${token}`;
                            resolve(apiClient(originalRequest));
                        } else {
                            resolve(Promise.reject(error)); // Reject if refresh fails
                        }
                    });
                });
            }

            // ✅ Handle session expiration (force logout)
            if (errorMessage === "Session Expired") {
                console.log("🚨 Session expired, logging out...");
                store.dispatch(getSession(1)); // Dispatch logout session
                await logoutUserAPI();

                setTimeout(() => {
                    window.location.href = "/"; // Redirect to login page
                }, 1000);
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;
