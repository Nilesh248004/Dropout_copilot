import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const parseCsvLine = (line) => {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result.map((value) => value.trim());
};

const buildPreview = (text) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1, 6).map(parseCsvLine);
  return { headers, rows };
};

const FacultyExports = () => {
  const [exportsList, setExportsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewMeta, setPreviewMeta] = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchExports = async () => {
    try {
      setLoading(true);
      setStatus(null);
      const res = await axios.get(`${API_BASE_URL}/exports`);
      setExportsList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setStatus({
        type: "error",
        message: err.response?.data?.error || "Unable to load exports.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (exportItem) => {
    if (exportItem?.content_preview) {
      setPreview(buildPreview(exportItem.content_preview));
      setPreviewMeta(exportItem);
      return;
    }
    try {
      setPreviewLoadingId(exportItem.id);
      const res = await axios.get(`${API_BASE_URL}/exports/${exportItem.id}`);
      const previewText = res.data?.content_preview || res.data?.content || "";
      setPreview(buildPreview(previewText));
      setPreviewMeta(res.data);
    } catch (err) {
      setStatus({
        type: "error",
        message: err.response?.data?.error || "Unable to load export preview.",
      });
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleDownload = async (exportItem) => {
    try {
      setDownloadingId(exportItem.id);
      const res = await axios.get(`${API_BASE_URL}/exports/${exportItem.id}/download`);
      if (res.data?.download_url) {
        const link = document.createElement("a");
        link.href = res.data.download_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }
      const content = res.data?.content || exportItem.content_preview || "";
      const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportItem.file_name || "faculty-export.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setStatus({
        type: "error",
        message: err.response?.data?.error || "Unable to download export.",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    fetchExports();
  }, []);

  const previewHeaders = useMemo(() => preview?.headers || [], [preview]);
  const previewRows = useMemo(() => preview?.rows || [], [preview]);

  const totalExports = exportsList.length;
  const totalRows = exportsList.reduce((sum, item) => sum + (item.row_count || 0), 0);
  const uniqueFaculty = new Set(exportsList.map((item) => item.faculty_id).filter(Boolean)).size;
  const latestExport = exportsList[0];

  return (
    <Container sx={{ mt: 4, mb: 6 }}>
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background:
            "linear-gradient(120deg, rgba(30,64,175,0.15), rgba(56,189,248,0.1))",
          border: "1px solid rgba(148,163,184,0.2)",
        }}
      >
        <Stack spacing={1}>
          <Typography variant="h4" fontWeight={700}>
            Faculty Export Inbox
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review prediction exports uploaded by faculty, preview the content, and download the CSV.
          </Typography>
        </Stack>
      </Paper>

      <Grid container spacing={2} mb={3}>
        {[
          { label: "Total Exports", value: totalExports },
          { label: "Total Rows", value: totalRows },
          { label: "Faculty Contributors", value: uniqueFaculty },
        ].map((stat) => (
          <Grid item xs={12} md={4} key={stat.label}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {stat.label}
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {stat.value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={fetchExports}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh List"}
          </Button>
          {latestExport && (
            <Chip
              label={`Latest: ${latestExport.file_name}`}
              color="primary"
              sx={{ ml: { md: "auto" } }}
            />
          )}
        </Stack>
        {status && (
          <Alert severity={status.type} sx={{ mt: 2 }}>
            {status.message}
          </Alert>
        )}
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" mb={2}>
              Received Exports
            </Typography>
            {exportsList.length === 0 ? (
              <Alert severity="warning">No exports uploaded yet.</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["File", "Faculty", "Rows", "Size", "Uploaded", "Actions"].map((header) => (
                      <TableCell key={header} sx={{ fontWeight: 600 }}>
                        {header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {exportsList.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography>{item.file_name}</Typography>
                          {latestExport?.id === item.id && (
                            <Chip label="Latest" size="small" color="primary" />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {item.uploaded_by_email || "Unknown uploader"}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.faculty_id || "—"}</TableCell>
                      <TableCell>{item.row_count ?? "—"}</TableCell>
                      <TableCell>{formatBytes(item.file_size || 0)}</TableCell>
                      <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Preview">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handlePreview(item)}
                                disabled={previewLoadingId === item.id}
                              >
                                <VisibilityRoundedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Download CSV">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleDownload(item)}
                                disabled={downloadingId === item.id}
                              >
                                <DownloadRoundedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 2.5, minHeight: 360 }}>
            <Typography variant="h6" mb={1}>
              Preview
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Select an export to preview the first few rows.
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {!previewMeta && (
              <Alert severity="info">No export selected yet.</Alert>
            )}
            {previewMeta && previewHeaders.length > 0 && (
              <>
                <Stack spacing={0.5} mb={2}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {previewMeta.file_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Faculty {previewMeta.faculty_id || "—"} •{" "}
                    {new Date(previewMeta.created_at).toLocaleString()}
                  </Typography>
                </Stack>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {previewHeaders.map((header) => (
                        <TableCell key={header} sx={{ fontWeight: 600 }}>
                          {header}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewRows.map((row, rowIndex) => (
                      <TableRow key={`${previewMeta.id}-row-${rowIndex}`}>
                        {previewHeaders.map((_, cellIndex) => (
                          <TableCell key={`${previewMeta.id}-cell-${rowIndex}-${cellIndex}`}>
                            {row[cellIndex] ?? ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default FacultyExports;
