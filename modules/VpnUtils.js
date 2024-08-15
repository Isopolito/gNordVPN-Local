export default class VpnUtils {
    // Remove the junk that shows up from messages in the nordvpn output
    processCityCountryOutput = (input) => {
        // Remove ANSI color escape sequences
        // \u001b is the ESC character, [\d+m matches one or more digits followed by 'm'
        // This regex targets color codes like \u001b[94m or \u001b[0m
        input = input.replace(/\u001b\[\d+m/g, '');

        // Remove leading non-word characters and underscores, and replace other non-word sequences with newlines
        // ^[\W_]+ matches one or more non-word characters or underscores at the start of the string
        // \W+ matches one or more non-word characters anywhere else
        // This helps to clean up the input and separate entries
        input = input.replace(/^[\W_]+|\W+/, '\n');

        // Split the input into an array by newlines and trim each entry
        // This creates an array where each element is a potential country/city name
        const countries = input.split('\n').map(c => c.trim());

        // Filter the array to keep only valid country/city names
        // The regex used here is a Unicode-aware pattern:
        //   ^ asserts the start of the string
        //   [\p{L}\p{M}] matches any Unicode letter or mark (like accents) for the first character
        //   [\p{L}\p{M}\s'-]* matches zero or more letters, marks, spaces, apostrophes, or hyphens for the rest
        //   $ asserts the end of the string
        // This allows for names like "São Paulo" or "Côte d'Ivoire"
        const validCountries = countries.filter(c => /^[\p{L}\p{M}][\p{L}\p{M}\s'-]*$/u.test(c));

        // Sort the array of valid names
        // localeCompare is used for proper alphabetical sorting across different locales
        // The 'sensitivity: "base"' option ignores case and diacritical marks in sorting
        return validCountries.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
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
