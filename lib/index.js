"use strict";

const BloggifyAdapter = require("bloggify-adapter")
    , mdify = require("mdify")
    , ul = require("ul")
    , sameTime = require("same-time")
    , bindy = require("bindy")
    ;

module.exports = class BloggifyMarkdownAdapter extends BloggifyAdapter {

    getArticlePath (id) {
        return `${this.paths.articles}/${id}.md`;
    }

    getPagePath (slug) {
        return `${this.paths.pages}/${slug}.md`;
    }

    getArticleById (id, cb) {
        mdify.parseFile(this.getArticlePath(id), this.parseOpts, cb);
    }

    getArticles (options, cb) {

        if (typeof options === "function") {
            cb = options;
            options = {};
        }

        options = ul.merge(options, {
            limit: 5
          , skip: 0
        });

        let rangeIds = [];
        for (let i = options.skip; i < options.skip + options.limit; ++i) {
            rangeIds.push(i);
        }

        sameTime(bindy(rangeIds, (cId, cb) => {
            this.getArticleById(cId, (err, data) => cb(null, err ? null : data));
        }), (err, articles) => {
            if (err) { return cb(err); }
            articles = articles.filter(c => c !== null);
            cb(null, articles);
        });
    }

    getPageBySlug (slug, cb) {
        mdify.parseFile(this.getPagePath(slug), this.parseOpts, cb);
    }
};
