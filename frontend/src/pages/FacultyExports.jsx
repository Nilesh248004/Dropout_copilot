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
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  TextField,
  MenuItem,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import axios from "axios";
import { alpha, useTheme } from "@mui/material/styles";
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
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
};

const FacultyExports = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;
  const surface = theme.palette.background.paper;
  const borderSoft = alpha(textPrimary, isDark ? 0.2 : 0.12);
  const panelShadow = isDark
    ? "0 18px 45px rgba(0, 0, 0, 0.45)"
    : "0 18px 40px rgba(15, 23, 42, 0.08)";
  const headerGradient = isDark
    ? "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.85) 55%, rgba(14,116,144,0.2) 100%)"
    : "linear-gradient(135deg, rgba(239,246,255,0.95) 0%, rgba(224,242,254,0.8) 55%, rgba(14,165,233,0.18) 100%)";
  const [exportsList, setExportsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewMeta, setPreviewMeta] = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewRiskFilter, setPreviewRiskFilter] = useState("ALL");

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
  const riskColumnIndex = useMemo(() => {
    if (!previewHeaders.length) return -1;
    return previewHeaders.findIndex((header) =>
      String(header || "").toLowerCase().includes("risk level")
    );
  }, [previewHeaders]);
  const filteredPreviewRows = useMemo(() => {
    if (!previewRows.length) return previewRows;
    const search = previewSearch.trim().toLowerCase();
    const risk = previewRiskFilter.toUpperCase();
    return previewRows.filter((row) => {
      const rowText = row.join(" ").toLowerCase();
      const matchesSearch = !search || rowText.includes(search);
      const matchesRisk = risk === "ALL" || rowText.includes(risk.toLowerCase());
      return matchesSearch && matchesRisk;
    });
  }, [previewRows, previewSearch, previewRiskFilter]);
  const previewCounts = useMemo(() => {
    const counts = {
      total: filteredPreviewRows.length,
      high: 0,
      medium: 0,
      low: 0,
    };
    filteredPreviewRows.forEach((row) => {
      let riskValue = "";
      if (riskColumnIndex >= 0) {
        riskValue = String(row[riskColumnIndex] || "").trim().toUpperCase();
      } else {
        const rowText = row.join(" ").toUpperCase();
        if (rowText.includes("HIGH")) riskValue = "HIGH";
        else if (rowText.includes("MEDIUM")) riskValue = "MEDIUM";
        else if (rowText.includes("LOW")) riskValue = "LOW";
      }
      if (riskValue === "HIGH") counts.high += 1;
      else if (riskValue === "MEDIUM") counts.medium += 1;
      else if (riskValue === "LOW") counts.low += 1;
    });
    return counts;
  }, [filteredPreviewRows, riskColumnIndex]);
  const isPreviewActive = Boolean(previewMeta && previewHeaders.length > 0);

  const totalExports = exportsList.length;
  const totalRows = exportsList.reduce((sum, item) => sum + (item.row_count || 0), 0);
  const uniqueFaculty = new Set(exportsList.map((item) => item.faculty_id).filter(Boolean)).size;
  const latestExport = exportsList[0];

  return (
    <Container
      maxWidth={false}
      disableGutters
      sx={{
        mt: 4,
        mb: 6,
        px: { xs: 2, md: 4 },
      }}
    >
      <Paper
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 4,
          background: headerGradient,
          border: `1px solid ${borderSoft}`,
          boxShadow: panelShadow,
          position: "relative",
          overflow: "hidden",
          "&::after": {
            content: '""',
            position: "absolute",
            right: -80,
            top: -120,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.28)} 0%, transparent 70%)`,
          },
        }}
      >
        <Stack spacing={1}>
          <Typography variant="overline" sx={{ letterSpacing: 3, color: textSecondary }}>
            Admin Workspace
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: -0.6 }}>
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
            <Paper
              sx={{
                p: 2.2,
                borderRadius: 3,
                border: `1px solid ${borderSoft}`,
                boxShadow: panelShadow,
                background: isDark
                  ? `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(
                      surface,
                      0.9
                    )} 60%)`
                  : `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(
                      surface,
                      0.98
                    )} 60%)`,
              }}
            >
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

      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 3,
          border: `1px solid ${borderSoft}`,
          boxShadow: panelShadow,
          bgcolor: alpha(surface, isDark ? 0.85 : 0.98),
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={fetchExports}
            disabled={loading}
            sx={{ alignSelf: { xs: "stretch", md: "auto" } }}
          >
            {loading ? "Loading..." : "Refresh List"}
          </Button>
          <Stack
            direction="row"
            spacing={1}
            sx={{ ml: { md: "auto" } }}
            justifyContent={{ xs: "flex-start", md: "flex-end" }}
            flexWrap="wrap"
          >
            <Chip label={`Showing all: ${exportsList.length}`} variant="outlined" />
            {latestExport && (
              <Chip label={`Latest: ${latestExport.file_name}`} color="primary" />
            )}
          </Stack>
        </Stack>
        {status && (
          <Alert severity={status.type} sx={{ mt: 2 }}>
            {status.message}
          </Alert>
        )}
      </Paper>

      <Grid container spacing={3} sx={{ width: "100%", m: 0 }}>
        <Grid item xs={12} lg={isPreviewActive ? 12 : 7} sx={{ width: "100%" }}>
          <Paper
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: `1px solid ${borderSoft}`,
              boxShadow: panelShadow,
              bgcolor: alpha(surface, isDark ? 0.88 : 0.99),
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              mb={2}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Received Exports
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  All faculty submissions, tracked and ready to review.
                </Typography>
              </Box>
              <Stack
                direction="row"
                spacing={1}
                sx={{ ml: { sm: "auto" } }}
                justifyContent={{ xs: "flex-start", sm: "flex-end" }}
                flexWrap="wrap"
              >
                <Chip
                  label={`${exportsList.length} total`}
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
                {latestExport && (
                  <Chip
                    label={`Latest: ${latestExport.file_name}`}
                    color="primary"
                    variant={isDark ? "outlined" : "filled"}
                  />
                )}
              </Stack>
            </Stack>
            {exportsList.length === 0 ? (
              <Alert severity="warning">No exports uploaded yet.</Alert>
            ) : isMobile ? (
              <Stack spacing={2}>
                {exportsList.map((item) => (
                  <Paper
                    key={item.id}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      border: `1px solid ${borderSoft}`,
                      background: alpha(surface, isDark ? 0.85 : 0.98),
                    }}
                  >
                    <Stack spacing={0.6}>
                      <Typography sx={{ fontWeight: 700 }}>{item.file_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.uploaded_by_email || "Unknown uploader"}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip
                          label={`Faculty: ${item.faculty_id || "N/A"}`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={`Rows: ${item.row_count ?? "N/A"}`}
                          size="small"
                          color="info"
                          variant={isDark ? "outlined" : "filled"}
                        />
                        <Chip
                          label={`Size: ${formatBytes(item.file_size || 0)}`}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Uploaded: {new Date(item.created_at).toLocaleString()}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} flexWrap="wrap" mt={1.5}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityRoundedIcon />}
                        onClick={() => handlePreview(item)}
                        disabled={previewLoadingId === item.id}
                      >
                        Preview
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<DownloadRoundedIcon />}
                        onClick={() => handleDownload(item)}
                        disabled={downloadingId === item.id}
                      >
                        Download
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <TableContainer
                sx={{
                  maxHeight: 520,
                  borderRadius: 2.5,
                  border: `1px solid ${borderSoft}`,
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow
                      sx={{
                        background: isDark
                          ? "linear-gradient(90deg, rgba(30,41,59,0.95), rgba(15,23,42,0.85))"
                          : "linear-gradient(90deg, rgba(226,232,240,0.9), rgba(241,245,249,0.7))",
                      }}
                    >
                      {[
                        { label: "File" },
                        { label: "Faculty" },
                        { label: "Rows" },
                        { label: "Size" },
                        { label: "Uploaded" },
                        { label: "Actions", align: "right" },
                      ].map((header) => (
                        <TableCell
                          key={header.label}
                          align={header.align || "left"}
                          sx={{
                            fontWeight: 700,
                            color: textPrimary,
                            borderBottom: `1px solid ${borderSoft}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {header.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {exportsList.map((item, index) => (
                      <TableRow
                        key={item.id}
                        hover
                        sx={{
                          backgroundColor: index % 2 === 0
                            ? alpha(theme.palette.primary.main, isDark ? 0.08 : 0.05)
                            : "transparent",
                          transition: "all 0.2s ease",
                          "&:hover": {
                            backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1),
                            boxShadow: `inset 0 0 0 1px ${alpha(
                              theme.palette.primary.main,
                              0.2
                            )}`,
                          },
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography sx={{ fontWeight: 600 }}>
                              {item.file_name}
                            </Typography>
                            {latestExport?.id === item.id && (
                              <Chip label="Latest" size="small" color="primary" />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {item.uploaded_by_email || "Unknown uploader"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.faculty_id || "N/A"}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.row_count ?? "N/A"}
                            size="small"
                            color="info"
                            variant={isDark ? "outlined" : "filled"}
                          />
                        </TableCell>
                        <TableCell>{formatBytes(item.file_size || 0)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {new Date(item.created_at).toLocaleDateString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(item.created_at).toLocaleTimeString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Preview">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => handlePreview(item)}
                                  disabled={previewLoadingId === item.id}
                                  sx={{
                                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                                    "&:hover": {
                                      bgcolor: alpha(theme.palette.primary.main, 0.2),
                                    },
                                  }}
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
                                  sx={{
                                    bgcolor: alpha(theme.palette.success.main, 0.12),
                                    "&:hover": {
                                      bgcolor: alpha(theme.palette.success.main, 0.2),
                                    },
                                  }}
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
              </TableContainer>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={isPreviewActive ? 12 : 5} sx={{ width: "100%" }}>
          <Paper
            sx={{
              p: 2.5,
              minHeight: { xs: "auto", sm: 360 },
              borderRadius: 3,
              border: `1px solid ${borderSoft}`,
              boxShadow: panelShadow,
              bgcolor: alpha(surface, isDark ? 0.88 : 0.99),
              width: "100%",
              maxWidth: "none",
            }}
          >
            <Typography variant="h6" mb={1}>
              Preview
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Select an export to preview the full CSV list.
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {!previewMeta && (
              <Alert severity="info">No export selected yet.</Alert>
            )}
            {previewMeta && previewHeaders.length > 0 && (
              <>
                <Stack spacing={0.5} mb={2}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    sx={{ wordBreak: "break-word" }}
                  >
                    {previewMeta.file_name}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ wordBreak: "break-word" }}
                  >
                    Faculty {previewMeta.faculty_id || "N/A"} -{" "}
                    {new Date(previewMeta.created_at).toLocaleString()}
                  </Typography>
                </Stack>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  mb={1}
                >
                  <TextField
                    size="small"
                    fullWidth
                    label="Search"
                    placeholder="Search in preview"
                    value={previewSearch}
                    onChange={(event) => setPreviewSearch(event.target.value)}
                  />
                  <TextField
                    size="small"
                    select
                    label="Risk"
                    value={previewRiskFilter}
                    onChange={(event) => setPreviewRiskFilter(event.target.value)}
                    sx={{ minWidth: { xs: "100%", sm: 160 } }}
                  >
                    {["ALL", "HIGH", "MEDIUM", "LOW"].map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  mb={1}
                >
                  <Typography variant="caption" color="text.secondary">
                    Rows shown: {filteredPreviewRows.length || 0}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip label={`Total ${previewCounts.total}`} size="small" variant="outlined" />
                    <Chip label={`High ${previewCounts.high}`} size="small" color="error" />
                    <Chip label={`Medium ${previewCounts.medium}`} size="small" color="warning" />
                    <Chip label={`Low ${previewCounts.low}`} size="small" color="success" />
                  </Stack>
                </Stack>
                <TableContainer
                  sx={{
                    maxHeight: { xs: "50vh", sm: 360 },
                    borderRadius: 2.5,
                    border: `1px solid ${borderSoft}`,
                    overflowX: "auto",
                    overflowY: "auto",
                    width: "100%",
                  }}
                >
                  <Table size="small" stickyHeader sx={{ width: "100%", tableLayout: "auto" }}>
                    <TableHead>
                      <TableRow>
                        {previewHeaders.map((header) => (
                          <TableCell
                            key={header}
                            sx={{ fontWeight: 600, whiteSpace: "nowrap" }}
                          >
                            {header}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredPreviewRows.map((row, rowIndex) => (
                        <TableRow key={`${previewMeta.id}-row-${rowIndex}`}>
                          {previewHeaders.map((_, cellIndex) => (
                            <TableCell
                              key={`${previewMeta.id}-cell-${rowIndex}-${cellIndex}`}
                              sx={{ whiteSpace: "normal", wordBreak: "break-word" }}
                            >
                              {cellIndex === riskColumnIndex ? (
                                <Chip
                                  size="small"
                                  label={String(row[cellIndex] || "N/A")}
                                  color={
                                    String(row[cellIndex] || "")
                                      .trim()
                                      .toUpperCase() === "HIGH"
                                      ? "error"
                                      : String(row[cellIndex] || "")
                                          .trim()
                                          .toUpperCase() === "MEDIUM"
                                        ? "warning"
                                        : String(row[cellIndex] || "")
                                            .trim()
                                            .toUpperCase() === "LOW"
                                          ? "success"
                                          : "default"
                                  }
                                  variant={
                                    String(row[cellIndex] || "")
                                      .trim()
                                      .toUpperCase() === "HIGH" ||
                                    String(row[cellIndex] || "")
                                      .trim()
                                      .toUpperCase() === "MEDIUM" ||
                                    String(row[cellIndex] || "")
                                      .trim()
                                      .toUpperCase() === "LOW"
                                      ? "filled"
                                      : "outlined"
                                  }
                                />
                              ) : (
                                row[cellIndex] ?? ""
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default FacultyExports;


