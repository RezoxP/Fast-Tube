const fs = require('fs');
const uas = `/workspaces/Fast-Tube/scripts/src/features/userAgentSpoofing.js`;
fs.writeFileSync(uas, `
if (window.h5vcc && window.h5vcc.tizentube && window.h5vcc.tizentube.SetUserAgent) {
    if (localStorage.getItem('userAgent')) {
        localStorage.removeItem('userAgent');
        window.h5vcc.tizentube.SetUserAgent("");
        location.reload();
    }
}
`);
