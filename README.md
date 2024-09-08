# Firebase Image Server
A barebones function to serve an image from a Firebase Storage bucket through a Firebase Hosting URL rewrite.

## How it works
1. A client requests an image on your site with the url `<your_domain>/files/width=400/height=300/example.jpg`.
2. Your Firebase Hosting is configured to route that request to the `getImage` Firebase Cloud Function.
3. `getImage` then retrieves the image from Firebase Storage, resizes it using `sharp`, converts to WebP (if applicable), and serves it with a `Cache-Control` header.

Next time the image is requested, it will either be retrived from the browser's or CDN's cache (provided it's within the specified `max-age` timeframe, otherwise it is retrieved again through the steps above). This keeps load times fast and reduces the bandwidth needed for your page to load.

## Adding to your Firebase project
Install `firebase-tools` and initialize your project like normal (ensure that Hosting and Functions are added as well). Copy the `functions/index.js` file into your functions folder, overwriting the default file created when initializing (or just copy the functions over if you have other existing functions).

### Installing `sharp`
This function utilizes the `sharp` image processing Node package. To add this to your Firebase Functions package library, you'll want to open a terminal and navigate to the `functions` folder of your project, then install it using npm:
```
npm install sharp
```
I've included my `package.json` and `package-lock.json` files as well for reference.

### Configuring the URL rewrite
In your Firebase configuration file (likely named `firebase.json`) add the following to the `hosting` section:
```
"rewrites": [
    {
        "source": "/files/**",
        "function": "getImage"
    }
]
```
This adds a URL rewrite to capture requests and route them to a Firebase Cloud Function.

You can replace the `/files/` prefix with any you prefer, just be sure to update the function to account for the rewrite. You can do this in the `extractParams()` function on line 21.

**Note:** Place this rewrite above the main URL rewrite if your Firebase project is configured as a single page application.

### Configuring Storage rules
The application that this was built for was meant to serve images publicly from a Firebase Storage Bucket, meaning my `read` setting was set to `true` with no other checks in place. This means that a user could theoretically try to retrieve any images stored in my bucket. This is fine in my case, as I only allow myself to manually upload files (`write` set to `false`). 

**It's imperative to ensure your security rules are properly set up, as you may allow users to retrieve private images uploaded by other users if the security rules are misconfigured.** If you require user authentication or have specific folders that you don't want to be servable, you will want to adjust your rules accordingly.

See the [Firebase documentation for configuring storage rules](https://firebase.google.com/docs/storage/security) for more information on configuring Storage security rules.

## Notes
I try to keep my README files basic and easy to read. If you feel that parts of this document (or comments within the code itself) are unclear, I encourage you to reach out to me so I can correct it.

To give credit where it's due: [Building Image CDN with Firebase](https://dev.to/dbanisimov/building-image-cdn-with-firebase-15ef).

The article above was extremely helpful to me while starting this project. I needed a way to cache the images I was retrieving from Storage (previously using `getDownloadURL`) to keep page loads fast. I don't really like TypeScript, and also I feel like the original code was more Google Cloud-focused rather than Firebase-focused, so I wanted to write my own version to use in my own projects.