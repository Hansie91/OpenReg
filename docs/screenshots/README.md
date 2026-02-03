# Screenshot Guide

This folder contains screenshots for the OpenReg README and documentation.

## Required Screenshots

Please capture the following screenshots at **1920x1080** resolution with the application in a clean state:

| Filename | Page | Description |
|----------|------|-------------|
| `dashboard.png` | Dashboard | Main dashboard showing daily summary cards, recent runs table, and charts |
| `reports.png` | Reports | Reports list with regulation badges and status indicators |
| `cdm.png` | CDM | Common Data Model page showing entity list and field lineage viewer |
| `data-quality.png` | Data Quality | Data Quality Analysis with trend charts and metrics |
| `schedules.png` | Schedules | Schedule management showing calendar config and preview panel |
| `runs.png` | Runs | Job runs list with status indicators and filters |
| `exceptions.png` | Exceptions | Exception queue showing validation failures and amendment UI |

## Screenshot Guidelines

1. **Resolution**: Capture at 1920x1080 or higher
2. **Browser**: Use Chrome or Firefox in incognito/private mode
3. **Theme**: Use the default light theme
4. **Data**: Ensure there is meaningful sample data visible
5. **Format**: Save as PNG with reasonable compression
6. **Size**: Keep each image under 500KB for fast loading

## Taking Screenshots

### Windows
- Use `Win + Shift + S` for Snipping Tool
- Or use browser DevTools device toolbar for consistent sizing

### macOS
- Use `Cmd + Shift + 4` then `Space` to capture window
- Or use browser DevTools device toolbar

### Chrome DevTools Method (Recommended)
1. Open DevTools (`F12`)
2. Toggle device toolbar (`Ctrl/Cmd + Shift + M`)
3. Set dimensions to 1920x1080
4. Capture screenshot from the device toolbar menu (three dots)

## After Adding Screenshots

Run the following to commit:

```bash
git add docs/screenshots/*.png
git commit -m "docs: add portal screenshots for README"
git push
```
