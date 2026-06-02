const fs = require('fs');
const files = ['index.html', 'crm.html', 'ordenes.html', 'vendedores.html', 'index.aspx', 'crm.aspx', 'ordenes.aspx', 'vendedores.aspx'];

files.forEach(file => {
    try {
        let content = fs.readFileSync(file, 'utf8');

        if (!content.includes('Análisis Clientes')) {
            if (file.endsWith('.html')) {
                content = content.replace(/<a href="(.*?vendedores.html)" class="dropdown-item(.*?)">[\s\S]*?<span>Análisis Vendedores<\/span>\s*<\/a>/,
                    `<a href="$1" class="dropdown-item$2">\n                            <i data-lucide="trending-up"></i>\n                            <span>Análisis Vendedores</span>\n                        </a>\n                        <a href="clientes.html" class="dropdown-item">\n                            <i data-lucide="pie-chart"></i>\n                            <span>Análisis Clientes</span>\n                        </a>`
                );
            } else {
                content = content.replace(/<a href="(.*?vendedores.aspx)" class="dropdown-item(.*?)">[\s\S]*?<span>Análisis Vendedores<\/span>\s*<\/a>/,
                    `<a href="$1" class="dropdown-item$2">\n                            <i data-lucide="trending-up"></i>\n                            <span>Análisis Vendedores</span>\n                        </a>\n                        <a href="clientes.aspx" class="dropdown-item">\n                            <i data-lucide="pie-chart"></i>\n                            <span>Análisis Clientes</span>\n                        </a>`
                );
            }

            fs.writeFileSync(file, content);
            console.log(`Updated ${file}`);
        } else {
            console.log(`Skipped ${file} (already updated)`);
        }
    } catch (e) {
        console.error(`Error with ${file}:`, e.message);
    }
});
