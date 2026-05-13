export declare const config: {
    auth: {
        jwtSecret: string;
        jwtExpiresIn: string;
        refreshTokenExpiresIn: string;
    };
    supabase: {
        url: string;
        anonKey: string;
        serviceRoleKey: string;
    };
    database: {
        url: string;
    };
    port: string | number;
    allowedOrigins: string;
};
export type Config = typeof config;
