module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // react-native-reanimated v4 uses worklets plugin
            'react-native-worklets/plugin',
        ],
    };
};
