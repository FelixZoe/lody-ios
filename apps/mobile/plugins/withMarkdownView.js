const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE = {
  name: 'MarkdownView',
  url: 'https://github.com/Innei/MarkdownView.git',
  branch: 'lody/inject-text-label-view',
};

const header = `plugin 'cocoapods-spm'
require 'cocoapods-spm/hooks/helpers/update_script'
# cocoapods-spm 0.1.20 appends to the app target's xcfilelists, which Expo's
# generated project never creates; touch them so the hook does not raise.
module LodySPMFileLists
  def update_script(options = {})
    aggregate_targets.each do |target|
      user_build_configurations.each_key do |config|
        %w[copy_resources_script embed_frameworks_script].each do |name|
          %w[input output].each do |kind|
            path = target.send("#{name}_#{kind}_files_path", config)
            FileUtils.touch(path) unless path.exist?
          end
        end
      end
    end
    super
  end
end
Pod::SPM::UpdateScript::Mixin.prepend(LodySPMFileLists)
`;

const spmPkg = `  spm_pkg "${PACKAGE.name}", :url => "${PACKAGE.url}", :branch => "${PACKAGE.branch}"\n`;

module.exports = function withMarkdownView(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfile = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile',
      );
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes("plugin 'cocoapods-spm'"))
        contents = header + contents;
      if (!contents.includes('spm_pkg "MarkdownView"')) {
        contents = contents.replace(
          /^target '([^']+)' do\n/m,
          (line) => line + spmPkg,
        );
      }
      fs.writeFileSync(podfile, contents);
      return config;
    },
  ]);
};
