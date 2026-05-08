import UIKit

final class ImageStorage {
    static let shared = ImageStorage()

    private init() {}

    private var imageDirectoryURL: URL {
        let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let directoryURL = documentsURL.appendingPathComponent("MonthBackgrounds", isDirectory: true)
        if !FileManager.default.fileExists(atPath: directoryURL.path) {
            try? FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        }
        return directoryURL
    }

    func save(_ image: UIImage, previousFilename: String? = nil) -> String? {
        if let previousFilename {
            delete(filename: previousFilename)
        }

        let filename = "\(UUID().uuidString).jpg"
        let fileURL = imageDirectoryURL.appendingPathComponent(filename)
        guard let data = image.jpegData(compressionQuality: 0.82) else { return nil }

        do {
            try data.write(to: fileURL, options: [.atomic])
            return filename
        } catch {
            return nil
        }
    }

    func load(filename: String?) -> UIImage? {
        guard let filename else { return nil }
        let fileURL = imageDirectoryURL.appendingPathComponent(filename)
        return UIImage(contentsOfFile: fileURL.path)
    }

    func delete(filename: String?) {
        guard let filename else { return }
        let fileURL = imageDirectoryURL.appendingPathComponent(filename)
        try? FileManager.default.removeItem(at: fileURL)
    }
}
