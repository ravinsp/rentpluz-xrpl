const storage = {

    // We are storing sensitive data here. Need to follow better security practices here.
    persist: function (key, obj) {
        localStorage.setItem(key, JSON.stringify(obj));
    },

    get: function (key) {
        const val = localStorage.getItem(key);
        if (val)
            return JSON.parse(val);
        else
            return null;
    },

    clear: function () {
        localStorage.removeItem("owner");
        localStorage.removeItem("property");
        localStorage.removeItem("tenant");
    },

    loadAppState: function () {
        const state = {};
        const owner = localStorage.getItem("owner");

        if (owner) {

            // Owner flow saved state.
            state.owner = {
                account: {
                    addr: JSON.parse(owner).addr
                }
            }

            const property = localStorage.getItem("property");
            if (property) {
                state.owner.property = {
                    account: {
                        addr: JSON.parse(property).addr
                    }
                }

                const tenant = localStorage.getItem("tenant");
                if (tenant) {
                    state.owner.property.tenant = {
                        account: {
                            addr: JSON.parse(tenant).addr
                        }
                    }
                }
            }
        }
        else {
            // Tenant flow saved state.
            const tenant = localStorage.getItem("tenant");
            if (tenant) {
                state.tenant = {
                    account: {
                        addr: JSON.parse(tenant).addr
                    }
                }

                const property = localStorage.getItem("property");
                if (property) {
                    state.tenant.property = {
                        account: {
                            addr: JSON.parse(property).addr
                        }
                    }
                }
            }
        }

        return state;
    }
}

export default storage;