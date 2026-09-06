require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'LodyKit'
  s.version = package['version']
  s.summary = 'First-party iOS capabilities and native UI for Lody.'
  s.homepage = 'https://github.com/Innei/lody-ios'
  s.license = { type: 'Proprietary' }
  s.authors = 'Innei'
  s.platform = :ios, '16.4'
  s.swift_version = '5.9'
  s.source = { git: 'https://github.com/Innei/lody-ios.git', tag: s.version.to_s }
  s.static_framework = true
  s.libraries = 'sqlite3'
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.resources = 'Resources/*'
end
