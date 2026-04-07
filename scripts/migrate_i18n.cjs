const fs = require('fs');
const path = require('path');

const androidPath = '/Users/darricordoba/Documents/GitHub/Play4CashAndroid/app/src/main/java/com/play4cash/play/util/AppStrings.kt';
const i18nDir = '/Users/darricordoba/Documents/GitHub/Play4CashPWA/src/i18n';

const languages = ['en', 'es', 'fr', 'de', 'it', 'pt'];

function parseAppStrings() {
    console.log('Reading AppStrings.kt...');
    const content = fs.readFileSync(androidPath, 'utf8');
    const strings = {};

    // Regex to match "key" to mapOf(...)
    const entryRegex = /"([^"]+)"\s+to\s+mapOf\s*\(([\s\S]*?)\)(?=\s*,|\s*\n\s*\))/g;
    let match;

    while ((match = entryRegex.exec(content)) !== null) {
        const key = match[1];
        const mapContent = match[2];
        const langMap = {};

        // Regex to match "lang" to "value"
        const langRegex = /"([^"]+)"\s+to\s+"([\s\S]*?)"/g;
        let langMatch;
        while ((langMatch = langRegex.exec(mapContent)) !== null) {
            const lang = langMatch[1];
            let value = langMatch[2];
            
            // Clean up Kotlin string escaping
            value = value.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\$/g, '$');
            
            langMap[lang] = value;
        }
        if (Object.keys(langMap).length > 0) {
            strings[key] = langMap;
        }
    }
    return strings;
}

try {
    const androidStrings = parseAppStrings();
    const keysCount = Object.keys(androidStrings).length;
    console.log(`Successfully parsed ${keysCount} keys from Android.`);

    languages.forEach(lang => {
        const filePath = path.join(i18nDir, `${lang}.json`);
        let currentJson = {};
        if (fs.existsSync(filePath)) {
            currentJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } else {
            console.warn(`File ${lang}.json does not exist, creating new.`);
        }

        // Merge Android strings at root level
        for (const [key, langMap] of Object.entries(androidStrings)) {
            if (langMap[lang]) {
                currentJson[key] = langMap[lang];
            } else if (langMap['en']) {
                currentJson[key] = langMap['en'];
            }
        }

        fs.writeFileSync(filePath, JSON.stringify(currentJson, null, 2), 'utf8');
        console.log(`Updated ${lang}.json.`);
    });

    console.log('Migration completed successfully.');
} catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
}
