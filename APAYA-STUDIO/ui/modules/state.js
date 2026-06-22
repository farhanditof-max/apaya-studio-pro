let activeProcessTab = 'camera';
let currentCredits = 0;
const DUMMY_BEFORE_IMG = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' style='background:%232a2d3d'%3E%3Ctext x='50%25' y='50%25' fill='%23FACC15' font-size='24' font-family='Arial' text-anchor='middle' dy='.3em'%3EDummy Preview (Belum Render)%3C/text%3E%3C/svg%3E";

let currentEnvC = "interior";
let currentEnvR = "interior";
let materialBoardBase64 = "";
let selectedConceptCam = "";

let currentCameras = [];
let activeRes = '4K';
let selectedCameras = new Set();
let hasLoadedFirstTime = false;
let cameraToRename = "";
let camerasToDelete = [];
