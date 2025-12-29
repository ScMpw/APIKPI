const ReportPDF = (() => {
  function drawChartToTempCanvas(canvas) {
    const maxDim = Math.max(canvas.width || 0, canvas.height || 0) || 1;
    const targetMax = 1600;
    const scale = Math.max(1, Math.min(2, targetMax / maxDim));
    const tmp = document.createElement('canvas');
    tmp.width = Math.round(canvas.width * scale);
    tmp.height = Math.round(canvas.height * scale);
    const ctx = tmp.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
    return tmp;
  }

  function canvasToOptimizedDataURL(canvas) {
    const tmp = drawChartToTempCanvas(canvas);
    return tmp.toDataURL('image/png');
  }

  function canvasToSVG(canvas) {
    const tempCanvas = drawChartToTempCanvas(canvas);
    const width = tempCanvas.width;
    const height = tempCanvas.height;

    const svgNS = 'http://www.w3.org/2000/svg';
    const xlinkNS = 'http://www.w3.org/1999/xlink';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('xmlns', svgNS);
    svg.setAttribute('xmlns:xlink', xlinkNS);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', '#ffffff');
    svg.appendChild(rect);

    const image = document.createElementNS(svgNS, 'image');
    const dataUrl = tempCanvas.toDataURL('image/png');
    image.setAttributeNS(xlinkNS, 'xlink:href', dataUrl);
    image.setAttribute('href', dataUrl);
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', width);
    image.setAttribute('height', height);
    image.setAttribute('preserveAspectRatio', 'none');
    svg.appendChild(image);

    return new XMLSerializer().serializeToString(svg);
  }

  async function exportPDF(chartInstances) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const charts = [...(chartInstances || [])];
    try {
      charts.forEach(ch => {
        if (!ch) return;
        const legend = ch.options.plugins?.legend || (ch.options.plugins.legend = {});
        const labels = legend.labels || (legend.labels = {});
        ch._origLegendFilter = labels.filter;
        labels.filter = item => item.text && !item.hidden;
        if (ch.options.plugins?.datalabels) {
          ch.options.plugins.datalabels.display = true;
        }
        ch.update();
      });
      const includePi = document.getElementById('includePi')?.checked;
      const includeDisruption = document.getElementById('includeDisruption')?.checked;
      const includeRating = document.getElementById('includeRating')?.checked;
      const includeThroughput = document.getElementById('includeThroughput')?.checked;
      const includeCycle = document.getElementById('includeCycle')?.checked;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let y = margin;
      const section = document.getElementById('chartSection');
      const children = section ? Array.from(section.children) : [];
      for (let i = 0; i < children.length; i += 2) {
        const boardTitleEl = children[i];
        const wrapper = children[i + 1];
        const boardTitle = boardTitleEl?.textContent?.trim() || '';
        const elems = wrapper ? Array.from(wrapper.children) : [];
        for (let j = 0; j < elems.length;) {
          const chartTitleEl = elems[j];
          if (!chartTitleEl || chartTitleEl.tagName !== 'H2') {
            j += 1;
            continue;
          }
          let canvas = null;
          let nextIndex = j + 1;
          while (nextIndex < elems.length) {
            const candidate = elems[nextIndex];
            nextIndex += 1;
            if (candidate && candidate.tagName === 'CANVAS') {
              canvas = candidate;
              break;
            }
          }
          j = nextIndex;
          if (!canvas) continue;
          const type = canvas.dataset.type;
          if ((type === 'pi' && !includePi) ||
              (type === 'disruption' && !includeDisruption) ||
              (type === 'rating' && !includeRating) ||
              (type === 'throughput' && !includeThroughput) ||
              (type === 'cycle' && !includeCycle)) {
            continue;
          }
          const width = pageWidth - margin * 2;
          const height = canvas.height * width / canvas.width;
          if (y + 14 + height > pageHeight - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.setFontSize(12);
          pdf.text(`${boardTitle} - ${chartTitleEl.textContent.trim()}`, margin, y);
          y += 14;
          let rendered = false;
          if (window.svg2pdf) {
            try {
              const svgString = canvasToSVG(canvas);
              const parser = new DOMParser();
              const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
              const svgElement = svgDoc.documentElement;
              await window.svg2pdf(svgElement, pdf, { x: margin, y, width, height });
              rendered = true;
            } catch (err) {
              console.error('SVG conversion failed, falling back to JPEG', err);
            }
          }
          if (!rendered) {
            pdf.addImage(canvasToOptimizedDataURL(canvas), 'JPEG', margin, y, width, height);
          }
          y += height + 10;
        }
      }
      const dateStr = new Date().toISOString().split('T')[0];
      pdf.save(`KPI_Report_${dateStr}.pdf`);
    } finally {
      charts.forEach(ch => {
        if (!ch) return;
        const legendLabels = ch.options.plugins?.legend?.labels;
        if (legendLabels) {
          legendLabels.filter = ch._origLegendFilter;
          delete ch._origLegendFilter;
        }
        if (ch.options.plugins?.datalabels) {
          ch.options.plugins.datalabels.display = false;
        }
        ch.update();
      });
    }
  }

  return { exportPDF };
})();
