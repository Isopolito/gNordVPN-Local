export default class VpnUtils {
    // Remove the junk that shows up from messages in the nordvpn output
    processCityCountryOutput = (input) => {
        input = input.replace(/\e\[\d+[\x6d]/, ''); // Remove color formatting
        input = input.replace(/^[\W_]+|\W+/, '\n'); // Remove any leading junk
        const countries = input.split('\n').map(c => c.trim()); // Split and trim each country name
        const validCountries = countries.filter(c => /\b\w[\w\s'-]*\b/.test(c)); // Keep valid country names
        const filteredLines = validCountries.filter(line => !line.includes('Virtual location servers'));
        return filteredLines.sort(); // Sort and return the valid country names
    };

    getString = (data) => {
        const decoder = new TextDecoder('utf-8');
        return data instanceof Uint8Array
            ? decoder.decode(data)
            : data.toString();
    }

    resolveSettingsValue(text) {
        if (!text) return;
        const normalizedText = text.trim();

        if (normalizedText === `enabled`) return true;
        if (normalizedText === `disabled`) return false;

        return normalizedText;
    }

    resolveSettingsKey(text) {
        if (!text) return;
        const normalizedText = text.trim().toLowerCase()

        if (normalizedText === `firewall`) return `firewall`;
        if (normalizedText.includes(`tech`)) return `technology`;
        if (normalizedText === `protocol`) return `protocol`;
        if (normalizedText === `kill switch`) return `killswitch`;
        if (normalizedText === `analytics`) return `analytics`;
        if (normalizedText === `threat protection lite`) return `cybersec`;
        if (normalizedText === `obfuscate`) return `obfuscate`;
        if (normalizedText === `notify`) return `notify`;
        if (normalizedText === `auto-connect`) return `autoconnect`;
        if (normalizedText === `ipv6`) return `ipv6`;

        // Currently these settings are not supported in this extension
        //if (normalizedText === `dns`) return `dns`;

        return null;
    }
}
