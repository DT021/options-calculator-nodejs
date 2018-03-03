module.exports = {

    Success : {

        OK : 200,
        CREATED : 201,
        ACCEPTED : 202,
        NO_CONTENT : 204
    },

    Redirection : {

        MOVED_PERMANENTLY : 301,
        FOUND : 302,
        SEE_OTHER : 303,
        NOT_MODIFIED : 304,
        TEMPRARY_REDIRECT : 307
    },

    Client : {

        BAD_REQUEST : 400,
        UNAUTHORIZED : 401,
        REQUEST_FAILED : 402,
        FORBIDDEN : 403,
        NOT_FOUND : 404,
        METHOD_NOT_ALLOWED : 405,
        NOT_ACCEPTIBALE : 406,
        CONFLICT : 409,
        PRECONDITION_FAILED : 412,
        UNSUPPORTED_MEDIA_TYPE : 415,
        TOO_MANY_REQUESTS : 429
    },

    Server : {

        INTERNAL_ERROR : 500,
        NOT_IMPLEMENTED : 501
    }
}
