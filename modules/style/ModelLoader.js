import {parseStored} from './AppearanceModel.js';
import {compile, sameStyles} from './StyleCompiler.js';
import {parse} from './LegacyStyleParser.js';

// Picks the model prefs should edit. `panel-appearance` is used only if it is valid and compiles to
// what the legacy keys hold; otherwise the legacy keys win and are parsed (grill Q1). This only reads:
// it never writes a setting.
// Returns {model, source: 'appearance' | 'legacy-empty' | 'legacy-malformed' | 'legacy-mismatch'}.
export function loadModel({appearanceJson, panelStyles, commonCss}) {
    const legacy = () => parse(panelStyles, commonCss);
    if (typeof appearanceJson !== 'string' || appearanceJson.trim() === '')
        return {model: legacy(), source: 'legacy-empty'};

    const stored = parseStored(appearanceJson);
    if (!stored) return {model: legacy(), source: 'legacy-malformed'};

    if (!sameStyles(compile(stored), {panelStyles, commonCss}))
        return {model: legacy(), source: 'legacy-mismatch'};
    return {model: stored, source: 'appearance'};
}
