module.exports = {

    Db: { // 10x

        NOT_CONNECTED:          { code: 100, message: "no database connection" },
        ACCESS_ERROR:           { code: 101, message: "database access failure" },
    },

    Cookie: { // 11x

        SET_FAILED:             { code: 110, message: "could not set cookie" },
    },

    Hook: { // 12x

        FAILED:                 { code: 120, message: "unknown error" },
    },

    Account : { // 2xx

        INVALID_CRED :          { code: 200, message: "invalid username and password combination" },
        NOT_CONFIRMED:          { code: 201, message: "account not yet confirmed" },
        NOT_AUTHORIZED:         { code: 202, message: "unauthorized request" },
        VERIFICATION_FAILED:    { code: 203, message: "invalid password" },
        USER_NOT_FOUND:         { code: 204, message: "user doesn't exist" },
        USER_ALREADY_EXISTS:    { code: 205, message: "user already exist" },
    },

    Mail: { // 3xx

        SENDING_FAILURE:        { code: 300, message: "failed to send mail" },
        INVALID_ADDRESS:        { code: 301, message: "invalid mail address" },
        UNKNOWN_ERROR:          { code: 302, message: "unknown error" },
    },

    Stripe: { // 4xx

        ACCESS_ERROR:           { code: 400, message: "access failure" },
        CHECKOUT_FAILURE:       { code: 401, message: "checkout failed" },
        UPDATE_FAILED:          { code: 402, message: "update failed" },
        DELETE_FAILED:          { code: 403, message: "deletion failed" },
        FIND_FAILED:            { code: 404, message: "find failed" },
    },
}
