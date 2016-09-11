module.exports = function () {
	try {
		return nw.App.getDataPath();
	} catch (e) {
		return './logs';
	}
};