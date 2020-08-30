// ==UserScript==
// @id             iitc-plugin-compute-ap-stats-only-destroy@ReBootYourMind
// @name           IITC plugin: Compute AP statistics only destroy
// @category       Info
// @version        0.1.0
// @namespace      https://github.com/ReBootYourMind/iitc-addons
// @updateURL      https://github.com/ReBootYourMind/iitc-addons/blob/master/compute-ap-stats-only-destroy.user.js
// @downloadURL    https://github.com/ReBootYourMind/iitc-addons/blob/master/compute-ap-stats-only-destroy.user.js
// @description    [iitc-2017-01-08-021732] Displays the per-team AP gains available by only destroying in the current view.
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @include        https://*.ingress.com/mission/*
// @include        http://*.ingress.com/mission/*
// @match          https://*.ingress.com/mission/*
// @match          http://*.ingress.com/mission/*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
plugin_info.buildName = 'iitc';
plugin_info.dateTimeVersion = '20170108.21732';
plugin_info.pluginId = 'compute-ap-stats';
//END PLUGIN AUTHORS NOTE



// PLUGIN START ////////////////////////////////////////////////////////

// use own namespace for plugin
window.plugin.compAPStatsOnlyDestroy = function() {};

window.plugin.compAPStatsOnlyDestroy.setupCallback = function() {
  // add a new div to the bottom of the sidebar and style it
  $('#sidebar').append('<div id="available_ap_display"></div>');
  $('#available_ap_display').css({'color':'#ffce00', 'font-size':'90%', 'padding':'4px 2px'});

  // do an initial calc for sidebar sizing purposes
  window.plugin.compAPStatsOnlyDestroy.update(false);

  // make the value update when the map data updates
  window.addHook('mapDataRefreshEnd', window.plugin.compAPStatsOnlyDestroy.mapDataRefreshEnd);
  window.addHook('requestFinished', window.plugin.compAPStatsOnlyDestroy.requestFinished);

}

window.plugin.compAPStatsOnlyDestroy.mapDataRefreshEnd = function() {
  if (window.plugin.compAPStatsOnlyDestroy.timer) {
    clearTimeout(window.plugin.compAPStatsOnlyDestroy.timer);
    window.plugin.compAPStatsOnlyDestroy.timer = undefined;
  }

  window.plugin.compAPStatsOnlyDestroy.update(true);
}

window.plugin.compAPStatsOnlyDestroy.requestFinished = function() {
  // process on a short delay, so if multiple requests finish in a short time we only calculate once
  if (window.plugin.compAPStatsOnlyDestroy.timer === undefined) {
    window.plugin.compAPStatsOnlyDestroy.timer = setTimeout( function() {
      window.plugin.compAPStatsOnlyDestroy.timer = undefined;
      window.plugin.compAPStatsOnlyDestroy.update(false);
    }, 0.75*1000);
  }
}

window.plugin.compAPStatsOnlyDestroy.update = function(hasFinished) {
  var result = window.plugin.compAPStatsOnlyDestroy.compAPStats();
  var loading = hasFinished ? '' : 'Loading...';

  var formatRow = function(team,data) {
    var title = 'Destroy and capture '+data.destroyPortals+' portals\n'
              + 'Destroy '+data.destroyLinks+' links and '+data.destroyFields+' fields\n'
              + 'Capture '+data.capturePortals+' neutral portals, complete '+data.finishPortals+' portals\n'
              + '(unknown additional AP for links/fields)';
    return '<tr><td>'+team+'</td><td style="text-align:right" title="'+title+'">'+digits(data.AP)+'</td></tr>';
  }


  $('#available_ap_display').html('Available AP in this area: '
    + loading
    + '<table>'
    + formatRow('Enlightened',result.enl)
    + formatRow('Resistance', result.res)
    + '</table>');
}


window.plugin.compAPStatsOnlyDestroy.compAPStats = function() {

  var result = {
    res: { AP: 0, destroyPortals: 0, capturePortals: 0, finishPortals: 0, destroyLinks: 0, destroyFields: 0 },
    enl: { AP: 0, destroyPortals: 0, capturePortals: 0, finishPortals: 0, destroyLinks: 0, destroyFields: 0 },
  };


  var displayBounds = map.getBounds();

  // AP to fully deploy a neutral portal
  var PORTAL_FULL_DEPLOY_AP = CAPTURE_PORTAL + 8*DEPLOY_RESONATOR + COMPLETION_BONUS;

  // Grab every portal in the viewable area and compute individual AP stats
  // (fields and links are counted separately below)
  $.each(window.portals, function(ind, portal) {
    var data = portal.options.data;

    // eliminate offscreen portals
    if(!displayBounds.contains(portal.getLatLng())) return true; //$.each 'continue'

    // AP to complete a portal - assuming it's already captured (so no CAPTURE_PORTAL)
    var completePortalAp = 0;
    var isFullyDeployed = data.resCount == 8;
    if (!isFullyDeployed) {
      //completePortalAp = data.resCount != 8 ? (8-data.resCount)*DEPLOY_RESONATOR + COMPLETION_BONUS : 0;
    }

    // AP to destroy this portal
    var destroyAp = data.resCount * DESTROY_RESONATOR;

    if (portal.options.team == TEAM_ENL) {
      result.res.AP += destroyAp; // + PORTAL_FULL_DEPLOY_AP;
      result.res.destroyPortals++;
      if (!isFullyDeployed) {
        //result.enl.AP += completePortalAp;
        result.enl.finishPortals++;
      }
    }
    else if (portal.options.team == TEAM_RES) {
      result.enl.AP += destroyAp; // + PORTAL_FULL_DEPLOY_AP;
      result.enl.destroyPortals++;
      if (!isFullyDeployed) {
        //result.res.AP += completePortalAp;
        result.res.finishPortals++;
      }
    } else {
      // it's a neutral portal, potential for both teams.  by definition no fields or edges
      //result.enl.AP += PORTAL_FULL_DEPLOY_AP;
      //result.enl.capturePortals++;
      //result.res.AP += PORTAL_FULL_DEPLOY_AP;
      //result.res.capturePortals++;
    }
  });

  // now every link that starts/ends at a point on screen
  $.each(window.links, function(guid, link) {
    // only consider links that start/end on-screen
    var points = link.getLatLngs();
    if (displayBounds.contains(points[0]) || displayBounds.contains(points[1])) {
      if (link.options.team == TEAM_ENL) {
        result.res.AP += DESTROY_LINK;
        result.res.destroyLinks++;
      } else if (link.options.team == TEAM_RES) {
        result.enl.AP += DESTROY_LINK;
        result.enl.destroyLinks++;
      }
    }
  });

  // and now all fields that have a vertex on screen
  $.each(window.fields, function(guid, field) {
    // only consider fields with at least one vertex on screen
    var points = field.getLatLngs();
    if (displayBounds.contains(points[0]) || displayBounds.contains(points[1]) || displayBounds.contains(points[2])) {
      if (field.options.team == TEAM_ENL) {
        result.res.AP += DESTROY_FIELD;
        result.res.destroyFields++;
      } else if (field.options.team == TEAM_RES) {
        result.enl.AP += DESTROY_FIELD;
        result.enl.destroyFields++;
      }
    }
  });

  return result;
}

var setup =  function() {
  window.plugin.compAPStatsOnlyDestroy.setupCallback();
}

// PLUGIN END //////////////////////////////////////////////////////////


setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);


