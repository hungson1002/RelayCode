import arrowUp from '@phosphor-icons/core/regular/arrow-up.svg';
import arrowCounterClockwise from '@phosphor-icons/core/regular/arrow-counter-clockwise.svg';
import arrowsClockwise from '@phosphor-icons/core/regular/arrows-clockwise.svg';
import brain from '@phosphor-icons/core/regular/brain.svg';
import broom from '@phosphor-icons/core/regular/broom.svg';
import caretDown from '@phosphor-icons/core/regular/caret-down.svg';
import caretRight from '@phosphor-icons/core/regular/caret-right.svg';
import chatCircle from '@phosphor-icons/core/regular/chat-circle.svg';
import checkCircle from '@phosphor-icons/core/regular/check-circle.svg';
import circlesThree from '@phosphor-icons/core/regular/circles-three.svg';
import codeBlock from '@phosphor-icons/core/regular/code-block.svg';
import copy from '@phosphor-icons/core/regular/copy.svg';
import clockCounterClockwise from '@phosphor-icons/core/regular/clock-counter-clockwise.svg';
import cube from '@phosphor-icons/core/regular/cube.svg';
import database from '@phosphor-icons/core/regular/database.svg';
import downloadSimple from '@phosphor-icons/core/regular/download-simple.svg';
import exportIcon from '@phosphor-icons/core/regular/export.svg';
import file from '@phosphor-icons/core/fill/file-fill.svg';
import fileAudio from '@phosphor-icons/core/fill/file-audio-fill.svg';
import fileC from '@phosphor-icons/core/fill/file-c-fill.svg';
import fileCpp from '@phosphor-icons/core/fill/file-cpp-fill.svg';
import fileCSharp from '@phosphor-icons/core/fill/file-c-sharp-fill.svg';
import fileCode from '@phosphor-icons/core/fill/file-code-fill.svg';
import fileCsv from '@phosphor-icons/core/fill/file-csv-fill.svg';
import fileDoc from '@phosphor-icons/core/fill/file-doc-fill.svg';
import fileImage from '@phosphor-icons/core/fill/file-image-fill.svg';
import fileIni from '@phosphor-icons/core/fill/file-ini-fill.svg';
import fileJpg from '@phosphor-icons/core/fill/file-jpg-fill.svg';
import fileMd from '@phosphor-icons/core/fill/file-md-fill.svg';
import filePdf from '@phosphor-icons/core/fill/file-pdf-fill.svg';
import filePng from '@phosphor-icons/core/fill/file-png-fill.svg';
import filePpt from '@phosphor-icons/core/fill/file-ppt-fill.svg';
import filePy from '@phosphor-icons/core/fill/file-py-fill.svg';
import fileRs from '@phosphor-icons/core/fill/file-rs-fill.svg';
import fileSql from '@phosphor-icons/core/fill/file-sql-fill.svg';
import fileSvg from '@phosphor-icons/core/fill/file-svg-fill.svg';
import fileText from '@phosphor-icons/core/fill/file-text-fill.svg';
import files from '@phosphor-icons/core/regular/files.svg';
import fileTxt from '@phosphor-icons/core/fill/file-txt-fill.svg';
import fileVideo from '@phosphor-icons/core/fill/file-video-fill.svg';
import fileVue from '@phosphor-icons/core/fill/file-vue-fill.svg';
import fileXls from '@phosphor-icons/core/fill/file-xls-fill.svg';
import fileZip from '@phosphor-icons/core/fill/file-zip-fill.svg';
import folderOpen from '@phosphor-icons/core/regular/folder-open.svg';
import gear from '@phosphor-icons/core/regular/gear.svg';
import gitDiff from '@phosphor-icons/core/regular/git-diff.svg';
import info from '@phosphor-icons/core/regular/info.svg';
import key from '@phosphor-icons/core/regular/key.svg';
import lightbulb from '@phosphor-icons/core/regular/lightbulb.svg';
import listSearch from '@phosphor-icons/core/regular/list-magnifying-glass.svg';
import magnifyingGlass from '@phosphor-icons/core/regular/magnifying-glass.svg';
import paperclip from '@phosphor-icons/core/regular/paperclip.svg';
import pencilSimple from '@phosphor-icons/core/regular/pencil-simple.svg';
import plugsConnected from '@phosphor-icons/core/regular/plugs-connected.svg';
import plus from '@phosphor-icons/core/regular/plus.svg';
import pulse from '@phosphor-icons/core/regular/pulse.svg';
import selection from '@phosphor-icons/core/regular/selection.svg';
import shieldWarning from '@phosphor-icons/core/regular/shield-warning.svg';
import slidersHorizontal from '@phosphor-icons/core/regular/sliders-horizontal.svg';
import spinnerGap from '@phosphor-icons/core/regular/spinner-gap.svg';
import target from '@phosphor-icons/core/regular/target.svg';
import terminalWindow from '@phosphor-icons/core/regular/terminal-window.svg';
import trash from '@phosphor-icons/core/regular/trash.svg';
import warning from '@phosphor-icons/core/regular/warning.svg';
import wrench from '@phosphor-icons/core/regular/wrench.svg';
import x from '@phosphor-icons/core/regular/x.svg';
import { materialCss, materialHtml, materialJavascript, materialTypescript } from './materialFileIcons';

export const UI_ICONS = {
  arrowCounterClockwise,
  arrowUp,
  arrowsClockwise,
  brain,
  broom,
  caretDown,
  caretRight,
  chatCircle,
  checkCircle,
  circlesThree,
  codeBlock,
  copy,
  clockCounterClockwise,
  cube,
  database,
  downloadSimple,
  export: exportIcon,
  file,
  fileAudio,
  fileC,
  fileCpp,
  fileCSharp,
  fileCode,
  fileCss: materialCss,
  fileCsv,
  fileDoc,
  fileHtml: materialHtml,
  fileImage,
  fileIni,
  fileJpg,
  fileJs: materialJavascript,
  fileJsx: materialJavascript,
  fileMd,
  filePdf,
  filePng,
  filePpt,
  filePy,
  fileRs,
  fileSql,
  fileSvg,
  fileText,
  files,
  fileTs: materialTypescript,
  fileTsx: materialTypescript,
  fileTxt,
  fileVideo,
  fileVue,
  fileXls,
  fileZip,
  folderOpen,
  gear,
  gitDiff,
  info,
  key,
  lightbulb,
  listSearch,
  magnifyingGlass,
  paperclip,
  pencilSimple,
  plugsConnected,
  plus,
  pulse,
  selection,
  shieldWarning,
  slidersHorizontal,
  spinnerGap,
  target,
  terminalWindow,
  trash,
  warning,
  wrench,
  x
} as const;

export type UiIconName = keyof typeof UI_ICONS;
