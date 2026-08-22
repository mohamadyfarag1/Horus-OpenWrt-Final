document.addEventListener('DOMContentLoaded', function() {
    setInterval(function() {
        document.querySelectorAll('td, .td').forEach(function(cell) {
            if (cell.dataset.macDone) return;
            var text = cell.innerText || '';
            var macMatch = text.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
            if (macMatch) {
                var mac = macMatch[0];
                var span = document.createElement('span');
                span.textContent = mac;
                span.style.cursor = 'pointer';
                span.style.borderBottom = '1px dashed #999';
                span.title = 'Click to copy MAC';
                span.onclick = function() {
                    navigator.clipboard.writeText(mac);
                    span.style.color = '#4caf50';
                    span.style.fontWeight = 'bold';
                    setTimeout(function(){ span.style.color = ''; span.style.fontWeight = ''; }, 1500);
                };
                cell.innerHTML = cell.innerHTML.replace(mac, span.outerHTML);
                cell.dataset.macDone = 'true';
            }
            var ipMatch = text.match(/\b([0-9]{1,3}\.){3}[0-9]{1,3}\b/);
            if (ipMatch && !cell.querySelector('a[href*="http"]')) {
                var ip = ipMatch[0];
                cell.innerHTML = cell.innerHTML.replace(ip, '<a href="http://' + ip + '" target="_blank" style="font-weight:bold; color:#0069d6; text-decoration:underline;">' + ip + '</a>');
            }
        });
    }, 2000);
});
